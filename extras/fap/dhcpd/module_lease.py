#!/usr/bin/python
# -*- coding: utf-8 -*-

'''
    Created by Jonas 'j' Lindstad for The Gathering 2015
    License: GPLv3
    
    Class used to fetch data from the Postgres DB
    
    Usage examples:
    lease.debug = True
    x = lease({'distro_name': 'distro-test', 'distro_phy_port': 'ge-0/0/6'}).get_dict()
    print('key lookup - hostname: %s' % x['hostname'])
'''

import psycopg2
import psycopg2.extras

# settings
settings = dict(
    db = dict(
	    user = '<user>',
	    password = '<password>',
	    dbname = '<db>',
	    host = '<host>'
    )
)

# connect to Postgres DB
connect_params = ("dbname='%s' user='%s' host='%s' password='%s'" % (settings['db']['dbname'], settings['db']['user'], settings['db']['host'], settings['db']['password']))
conn = psycopg2.connect(connect_params)
cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

#
# TESTING - Bruker ID fra DB-en som identifier, og kjører en query per lease.get_x()
#
class lease2(object):
    debug = False
    sysname = False
    identifiers = False
    
    # identifiers = dict of field/values
    def __init__(self, identifiers):
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
        if len(identifiers) > 0: # 1 or more identifiers - we're good to go
            self.identifiers = identifiers # Used to debug if no match for the identifiers is given
            
            # build query string
            where_pieces = []
            for identifier in identifiers.items():
                where_pieces.append(str(identifier[0]) + " = '" + str(identifier[1]) + "'")
            where = ' AND '.join(where_pieces)
            select = "SELECT sysname FROM switches WHERE " + where + " LIMIT 1"
            
            if self.debug is True:
                print('Executing query: ' + select)
            
            cur.execute(select)
            rows = cur.fetchall()
            cur.close()
            if len(rows) is 1:
                if self.debug is True:
                    print('returned from DB:')
                    print(rows[0][0])
                self.sysname = rows[0][0]
            else:
                self.sysname = False
        else:
            print('Missing identifier parameter')
            exit()
            
    # Used to fetch fields from DB
    def get(self, field):
        if self.sysname is not False:
            cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
            query = "SELECT %s FROM switches WHERE sysname = '%s' LIMIT 1" % (field, self.sysname)
            if self.debug is True:
                print('Query: %s' % query)
            
            try:
                cur.execute(query)
                rows = cur.fetchall()
                
                if len(rows) is 1:
                    if self.debug is True:
                        print('returned from DB:')
                        print(rows[0][0])
                    return rows[0][0]
                else:
                    if self.debug is True:
                        print('No data found - field: %s' % field)
                    return False
            except psycopg2.ProgrammingError:
                print('Field (%s) not found' % field)
                conn.rollback() # Prevents DB from locking up the next queries - http://initd.org/psycopg/docs/connection.html#connection.rollback
                return False
        else:
            print('identifiers (%s) not found' % self.identifiers)
            return False
            
    # Used to set fields in DB
    def set(self, field, value):
        if self.sysname is not False:
            cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            query = "UPDATE switches SET %s = '%s' WHERE sysname = '%s'" % (field, value, self.sysname)
            if self.debug is True:
                print('Query: %s' % query)
            try:
                cur.execute(query)
                conn.commit()
                return True
            except psycopg2.ProgrammingError:
                print('Field (%s) not found' % field)
                conn.rollback()
                return False
        else:
            print('identifiers (%s) not found' % self.identifiers)
            return False
