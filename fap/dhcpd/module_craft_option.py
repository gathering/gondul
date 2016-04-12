#!/usr/bin/python
# -*- coding: utf-8 -*-

'''
    Created by Jonas 'j' Lindstad for The Gathering 2015
    License: GPLv3
    
    Class used to craft byte hex encoded DHCP options
    
    NB: No direct support for suboptions. Should be possible to craft suboptions as
    options, and inject them with craft_option(<option>).raw_hes(<conconcatenated options>)
    
    Usage examples:
    craft_option.debug = True
    print(craft_option(1).string('vg.no'))
    print(craft_option(2).bytes(b'abcd'))
    print(craft_option(3).bytes(socket.inet_aton('192.168.0.55')))
    print(craft_option(4).bytes(b'\xde\xad\xbe\xef\xfe\xed'))
    print(craft_option(5).raw_hex(b'\x72\x78'))
    print(craft_option(6).ip('255.255.128.0'))
'''

from binascii import hexlify, unhexlify

class craft_option(object):
    # content = b'' # content will be stored as hex values like hex(10) + hex(255) =  0aff
    debug = False
    def __init__(self, code):
        self.code = self.__int_to_pad_byte(code)

    # Works as intended
    # internal function. Converts int(3) to str('03'), int('11') to str('0b'), int(255) to str('ff')
    def __int_to_pad_byte(self, integer):
        return hex(integer).split('x')[1].rjust(2, '0').encode()

    # Works as intended
    def string(self, string):
        self.method = 'string'
        self.content = hexlify(string.encode())
        return self.process()

    # Works as intended
    def bytes(self, bytes):
        self.method = 'bytes'
        self.content = hexlify(bytes)
        return self.process()
        
    # Works as intended
    # str('10.20.30.40') to b'\x10\x20\x30\x40'
    def ip(self, ip):
        self.method = 'ip'
        self.content = ''.join([hex(int(i))[2:].rjust(2, '0') for i in ip.split('.')]).encode()
        return self.process()

    # Works as intended
    # string like '\x72\x78' for 'rx'
    def raw_hex(self, raw_hex):
        self.method = 'raw_hex'
        self.content = hexlify(raw_hex)
        return self.process()



    # TODO Does not work as intended
    # int(666) to b'\x02\x9A'
    def integer(self, integer):
        self.method = 'integer'
        self.content = ''.join([hex(int(i))[2:].rjust(2, '0') for i in ip.split('.')])
        return self.process()
        
    def process(self):
        length = self.__int_to_pad_byte(len(unhexlify(self.content)))
        if self.debug is True:
            print('----------')
            print(self.method + '():')
            print(self.code + length)
            print(b'content: ' + self.content)
            print(unhexlify(self.content))
        return unhexlify(self.code + length + self.content)
