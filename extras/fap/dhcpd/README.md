# DHCPD

FAP carefully mimic ISC-DHCPD in regards to the exact bytes that needs to be sent to the Juniper platform in order to get ZTP (zero touch protocol) to play along.

## Files
* DHCP_protocol_breakdown.txt - Describes each field in the DHCP packet
* module_craft_option.py - Creates the correct byte sequence for DHCP options (suboptions can be solved by chaining the class)
* module_lease.py - Provedes access to set/get info from the DB (NMS)
* server_dhcp.py - The whole shebang that responds to DHCP packets.
