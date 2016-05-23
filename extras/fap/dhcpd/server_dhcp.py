#!/usr/bin/python
# -*- coding: utf-8 -*-

'''
server_dhcp.py by Jonas "j" Lindstad for The Gathering tech:server

Used to configure the Juniper EX2200 edge switches with Zero Touch Protocol
License: GPLv2

Based on the work of psychomario - https://github.com/psychomario
'''


'''

TODO

 * try/catch around each incomming packet - prevents DHCP-server from crashing if it receives a malformed packet
 
'''

import socket, binascii, IN
from module_craft_option import craft_option # Module that crafts DHCP options
# from module_lease import lease # Module that fetches data from DB and provides data for the lease
from module_lease import lease2 as lease # Module that fetches data from DB and provides data for the lease


# Global options - not a pretty hack
options_raw = {} # TODO - not a nice way to do things
option_82_1 = ''
client = ''


#############
# FUNCTIONS #
#############

# Generator for each of the dhcp fields
def split_packet(msg,slices): 
    for x in slices:
        yield msg[:x]
        msg = msg[x:]

# Splits a chunk of hex into a list of hex. (0123456789abcdef => ['01', '23', '45', '67', '89', 'ab', 'cd', 'ef'])
def chunk_hex(hex):
    return [hex[i:i+2] for i in range(0, len(hex), 2)]

# Convert hex IP to string with formated decimal IP. (0a0000ff => 10.0.0.255)
def hex_ip_to_str(hex_ip):
    return '.'.join(str(y) for y in map(lambda x: int(x, 16), chunk_hex(hex_ip))) # cast int to str for join

# formats a MAC address in the format "b827eb9a520f" to "b8:27:eb:9a:52:0f"
def format_hex_mac(hex_mac):
    return ':'.join(str(x) for x in chunk_hex(hex_mac))

# Formats a 6 byte MAC to a readable string (b'5e\x21\x00r3' => '35:65:21:00:72:33')
def six_byte_mac_to_str(mac):
    return ':'.join('%02x' % byte for byte in mac)

# b'b827eb9a520f' => 'b8:27:eb:9a:52:0f'
def prettyprint_hex_as_str(hex):
    return ':'.join('%02x' % byte for byte in binascii.unhexlify(hex))

# CIDR notation to subnet string ('25' => '255.255.255.128')
def cidr_to_subnet(cidr):
    mask = [0, 0, 0, 0]
    for i in range(int(cidr)):
        mask[i//8] = mask[i//8] + (1 << (7 - i % 8))
    return '.'.join(str(x) for x in mask)

# Parses DHCP options - raw = hex options
def parse_options(raw):
    print('[%s] --> processing DHCP options' % client)
    chunked = chunk_hex(raw)
    chunked_length = len(chunked)
    pointer = 0 # counter - next option start
    options = {} # options dataset
    
    global options_raw 
    options_raw = {} # incomming request's options
    special_options = [53, 82]

    while True: # Loop over the DHCP options
        option = int(chunked[pointer], 16) # option ID (0 => 255)
        code = int(chunked[pointer], 16) # option code (0 => 255) # New int for options' ID with correct name. Replaces $option
        
        length = int(chunked[pointer+1], 16) # option length
        option_payload = raw[((pointer+2)*2):((pointer+length+2)*2)] # Contains the payload of the option - without option ID and length
        options_raw[code] = option_payload # copying incomming request's options, directly usable in outgoing replies
        
        asciivalue = binascii.unhexlify(option_payload) # should not contain unreadable characters
        
        if option in special_options:
            if option is 82:
                option82_raw = option_payload
                options[option] = parse_suboptions(option, option_payload)
            elif option is 53:
                options[option] = option_payload
                # options[option] = 1 # Not adding DHCP DISCOVER to the options list, becouse it will not be used further on
                if int(chunked[pointer+2], 16) is 1:
                    print('[%s]     --> option: %s: %s' % (client, option, 'DHCP Discover (will not be used in reply)'))
                else:
                    print('[%s]     --> option: %s: %s' % (client, option, asciivalue))

        else:
            options[option] = asciivalue
            # TODO: Formating.... Also crap code
            try:
                if len(asciivalue) > 30:
                    print('[%s]     --> option: %s: %s' % (client, option, asciivalue[:26] + ' [...]'))
                else:
                    print('[%s]     --> option: %s: %s' % (client, option, asciivalue))
            except Exception:
                if len(asciivalue) > 30:
                    print('[%s]     --> option: %s: %s' % (client, option, prettyprint_hex_as_str(option_payload)[:26] + ' [...]'))
                else:
                    print('[%s]     --> option: %s: %s' % (client, option, prettyprint_hex_as_str(option_payload)))
                pass

        pointer = pointer + length + 2 # place pointer at the next options' option ID/code field
        
        if int(chunked[pointer], 16) is 255: # end of DHCP options - should allways last field
            print('[%s] --> Finished processing options' % client)
            break
    return options

# Parses suboptions
def parse_suboptions(option, raw):
    print('[%s]     --> processing suboption hook for option %s' % (client, option))
    chunked = chunk_hex(raw)
    chunked_length = len(chunked)
    pointer = 0 # counter - next option start
    dataset = {}
    
    if option is 82: # Option 82 - custom shit: Setting global variable to list
        global option_82_1
        
    while True:
        length = int(chunked[pointer+1], 16) # option length in bytes
        value = raw[4:(length*2)+(4)]

        if option is 82 and int(chunked[0], 16) is 1: # Option 82 - custom shit: Putting data in list
            option_82_1 = binascii.unhexlify(value).decode()

        print('[%s]         --> suboption %s found - value: "%s"' % (client, int(chunked[0], 16), binascii.unhexlify(value).decode())) # will fail on non-ascii characters
        
        dataset[int(chunked[0], 16)] = value
        pointer = pointer + length + 2 # place pointer at the next options' option ID/code field
        if pointer not in chunked: # end of DHCP options - allways last field
            print('[%s]     --> Finished processing suboption %s' % (client, option))
            break
    return dataset

# Parses and handles DHCP DISCOVER or DHCP REQUEST
def reqparse(message):
    data=None
    dhcpfields=[1,1,1,1,4,2,2,4,4,4,4,6,10,192,4,message.rfind(b'\xff'),1]
    hexmessage=binascii.hexlify(message)
    messagesplit=[binascii.hexlify(x) for x in split_packet(message,dhcpfields)]
    
    global client
    client = prettyprint_hex_as_str(messagesplit[11])
    
    if messagesplit[11][0:6] != b'44f477':
        print('[%s] Client not Juniper - exiting (GIADDR: %s)' % (client, hex_ip_to_str(messagesplit[10])))
        return False
    
    print('[%s] Parsing DHCP packet from client' % client)

    #
    # Logical checks to decide to whether respond or reject
    #
    if int(hex_ip_to_str(messagesplit[10]).replace('.', '')) is 0: # DHCP request has been forwarded by DHCP relay - A bit haxxy..
        print('[%s] Rejecting to process DHCP packet - not forwarded by DHCP relay' % client)
        return False


    # Process DHCP options
    options = parse_options(messagesplit[15])
        
    # Option 82 is set in the packet
    if 82 not in options:
        print('[%s] Rejecting to process DHCP packet - DHCP option 82 not set' % client)
        return False
    
    # 1 = DHCP Discover message (DHCPDiscover).
    # 2 = DHCP Offer message (DHCPOffer).
    # 3 = DHCP Request message (DHCPRequest).
    # 4 = DHCP Decline message (DHCPDecline).
    # 5 = DHCP Acknowledgment message (DHCPAck).
    # 6 = DHCP Negative Acknowledgment message (DHCPNak).
    # 7 = DHCP Release message (DHCPRelease).
    # 8 = DHCP Informational message (DHCPInform).

    # Check DHCP request type
    if options[53] == b'01':
        mode = 'dhcp_discover'
        print('[%s] --> DHCP packet type: DHCP DISCOVER' % client)
    elif options[53] == b'03':
        mode = 'dhcp_request'
        print('[%s] --> DHCP packet type: DHCP REQUEST' % client)
    elif options[53] == b'04':
        print('[%s] --> DHCP packet type: DHCP DECLINE - Not implemented' % client)
        return False
    elif options[53] == b'05':
        print('[%s] --> DHCP packet type: DHCP ACK - Not implemented' % client)
        return False
    elif options[53] == b'06':
        print('[%s] --> DHCP packet type: DHCP NEGATIVE ACK - Not implemented' % client)
        return False
    elif options[53] == b'07':
        print('[%s] --> DHCP packet type: DHCP RELEASE - Not implemented' % client)
        return False
    elif options[53] == b'08':
        print('[%s] --> DHCP packet type: DHCP INFORM - Not implemented' % client)
        return False
    else:
        print('[%s] Rejecting to continue process DHCP packet - option 53 missing' % client) # Small sanity check
        return False
    
    
    #
    # Packet passes our requirements
    #
    print('[%s] --> DHCP packet contains option 82 - continues to process' % client)
    print('[%s] --> DHCP packet forwarded by relay %s' % (client, hex_ip_to_str(messagesplit[10])))
    print('[%s] --> DHCP XID/Transaction ID: %s' % (client, prettyprint_hex_as_str(messagesplit[4])))
    
    # Handle DB request - do DB lookup based on option 82
    print('[%s] --> Looking up in the DB' % (client))
    
    option_82_1_pieces = option_82_1.split(':')
    
    if len(option_82_1_pieces) == 3:
        (distro, phy, vlan) = option_82_1.split(':')
        print('[%s]     --> Query details: distro_name:%s, distro_phy_port:%s' % (client, distro, phy.split('.')[0]))
        
        lease_identifiers = {'distro_name': distro, 'distro_phy_port': phy.split('.')[0]}
        print('### lease identifiers ###')
        print(lease_identifiers)
        if lease(lease_identifiers).get('sysname') is not False:

            l={
                'sysname': lease(lease_identifiers).get('sysname'),
                'mgmt_v4_addr': lease(lease_identifiers).get('mgmt_v4_addr'),
                'mgmt_v4_gw': lease(lease_identifiers).get('mgmt_v4_gw'),
                'mgmt_v4_cidr': lease(lease_identifiers).get('mgmt_v4_cidr')
            }
            
            print('### variabel l ###')
            print(l)
        
            # lease_details = lease({'distro_name': distro, 'distro_phy_port': phy[:-2]}).get_dict()
            print('[%s]     --> Data found, switch exists in DB - ready to craft response' % client)
        else:
            print('[%s]     --> Data not found, switch does not exists in DB' % client)
            return False
    elif len(option_82_1_pieces) > 0:
        print('[%s]     --> Option 82 does not contained required syntax (<distro>:<phy_port>:<vlan>)' % client)
        print('[%s]     --> Option 82: %s' % (client, option_82_1))
        print('[%s] --> Ending request' % client)
        return False
    else:
        print('[%s] Rejecting to continue to process DHCP packet - option 82.1 is empty' % client)
    
    if mode == 'dhcp_discover':
        print('[%s] --> Crafting DHCP OFFER response' % client)
        
    if mode == 'dhcp_request':
        print('[%s] --> Crafting DHCP ACK response' % client)
        
    print('[%s]     --> XID/Transaction ID: %s' % (client, prettyprint_hex_as_str(messagesplit[4])))
    print('[%s]     --> Client IP: %s' % (client, l['mgmt_v4_addr']))
    print('[%s]     --> DHCP forwarder IP: %s' % (client, l['mgmt_v4_gw']))
    print('[%s]     --> Client MAC: %s' % (client, client))

    fix_mgmt_v4_addr = l['mgmt_v4_addr'].split('/')[0]

    data = b'\x02' # Message type - boot reply
    data += b'\x01' # Hardware type - ethernet
    data += b'\x06' # Hardware address length - 6 octets for MAC
    data += b'\x01' # Hops
    data += binascii.unhexlify(messagesplit[4]) # XID / Transaction ID
    data += b'\x00\x00' # seconds elapsed - 1 second
    data += b'\x80\x00' # BOOTP flags - broadcast (unicast: 0x0000)
    data += b'\x00'*4 # Client IP address
    data += socket.inet_aton(fix_mgmt_v4_addr) # New IP to client
    data += socket.inet_aton(dhcp_server_address) # Next server IP address
    data += socket.inet_aton(l['mgmt_v4_gw']) # Relay agent IP - DHCP forwarder
    data += binascii.unhexlify(messagesplit[11]) # Client MAC
    data += b'\x00'*202 # Client hardware address padding (10) + Server hostname (64) + Boot file name (128)
    data += b'\x63\x82\x53\x63' # Magic cookie
    
    #
    # Craft DHCP options
    #
    print('[%s] --> Completed DHCP header structure, building DHCP options' % client)
    
    if mode == 'dhcp_discover':
        print('[%s]     --> Option 53  (DHCP OFFER): 2' % client)
        data += craft_option(53).raw_hex(b'\x02') # Option 53 - DHCP OFFER

    if mode == 'dhcp_request':
        print('[%s]     --> Option 53  (DHCP ACK): 5' % client)
        data += craft_option(53).raw_hex(b'\x05') # Option 53 - DHCP ACK
    
    data += craft_option(54).bytes(socket.inet_aton(dhcp_server_address)) # Option 54 - DHCP server identifier
    print('[%s]     --> Option 54  (DHCP server identifier): %s' % (client, dhcp_server_address))
    
    data += craft_option(51).raw_hex(b'\x00\x00\xa8\xc0') # Option 51 - Lease time left padded with "0"
    print('[%s]     --> Option 51  (Lease time): %s' % (client, '43200 (12 hours)'))
    
    # data += craft_option(1).ip(cidr_to_subnet(l['mgmt_v4_cidr'])) # Option 1 - Subnet mask
    data += craft_option(1).ip(cidr_to_subnet(26)) # Option 1 - Subnet mask
    print('[%s]     --> Option 1   (subnet mask): %s' % (client, cidr_to_subnet(26)))
    
    data += craft_option(3).ip(l['mgmt_v4_gw']) # Option 3 - Default gateway (set to DHCP forwarders IP)
    print('[%s]     --> Option 3   (default gateway): %s' % (client, l['mgmt_v4_gw']))
    
    data += craft_option(150).bytes(socket.inet_aton(dhcp_server_address)) # Option 150 - TFTP Server. Used as target for the Zero Touch Protocol. Not necessarily TFTP protocol used.
    print('[%s]     --> Option 150 (Cisco proprietary TFTP server(s)): %s' % (client, dhcp_server_address))
    
    # http://www.juniper.net/documentation/en_US/junos13.2/topics/concept/software-image-and-configuration-automatic-provisioning-understanding.html
    data += craft_option(43).bytes(craft_option(0).string(target_junos_file) + craft_option(1).string('/tg-edge/' + l['sysname']) + craft_option(3).string('http')) # Option 43 - ZTP
    print('[%s]     --> Option 43  (Vendor-specific option):' % client)
    print('[%s]         --> Suboption 0: %s' % (client, target_junos_file))
    print('[%s]         --> Suboption 1: %s' % (client, '/tg-edge/' + l['sysname']))
    print('[%s]         --> Suboption 3: %s' % (client, 'http'))

    data += b'\xff'
    
    lease(lease_identifiers).set('current_mac', client) # updates MAC in DB
    
    return data

if __name__ == "__main__":
    interface = b'eth0'
    dhcp_server_address = '185.110.148.22'
    target_junos_file = '/files/jinstall-ex-2200-14.1X53-D15.2-domestic-signed.tgz'
    
    # Setting up the server, and how it will communicate    
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM) # IPv4 UDP socket
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    s.setsockopt(socket.SOL_SOCKET, 25, interface)
    s.bind(('', 67))

    # Starting the whole loop
    print('Starting main loop')
    while True: #main loop
        try:
            message, addressf = s.recvfrom(8192)
            # print(message)
            if message.startswith(b'\x01'): # UDP payload is DHCP request (discover, request, release)
                if addressf[0] == '0.0.0.0':
                    # print('[%s] DHCP broadcast - unsupported' % client)
                    reply_to = '<broadcast>'
                else:
                    print('[%s] DHCP unicast - DHCP forwarding' % client)
                    reply_to = addressf[0] # senders (DHCP forwarders) IP
                    # print(addressf[0])
                    # reply_to = '10.0.0.1'
                    data=reqparse(message) # Parse the DHCP request
                    if data:
                        print('[%s] --> replying to %s' % (client, reply_to))
                        s.sendto(data, (reply_to, 67)) # Sends reply
                        print('')
        except KeyboardInterrupt:
            exit()
