# Database layout

PostgreSQL

**Tables**
```
bootstrap-> \dt
           List of relations
 Schema |   Name   | Type  |   Owner   
--------+----------+-------+-----------
 public | switches | table | bootstrap
```


**Table structure**
```
fap=> \d switches
                                      Table "public.switches"
      Column       |          Type          |                       Modifiers                       
-------------------+------------------------+-------------------------------------------------------
 id                | integer                | not null default nextval('switches_id_seq'::regclass)
 hostname          | character varying(20)  | 
 distro_name       | character varying(100) | 
 distro_phy_port   | character varying(100) | 
 mgmt_v4_addr      | character varying(15)  | 
 mgmt_v4_cidr      | smallint               | 
 mgmt_v4_gw        | character varying(15)  | 
 mgmt_v6_cidr      | smallint               | 
 mgmt_v6_addr      | character varying(35)  | 
 mgmt_v6_gw        | character varying(35)  | 
 mgmt_vlan         | smallint               | 
 last_config_fetch | integer                | 
 current_mac       | character varying(17)  | 
 model             | character varying(20)  | 
 traffic_vlan      | integer                | 
```


**Sample content in DB**
```
fap=> select * from switches where [...] order by id desc;
 id  |      hostname      |  distro_name   | distro_phy_port |  mgmt_v4_addr   | mgmt_v4_cidr |   mgmt_v4_gw    | mgmt_v6_cidr |    mgmt_v6_addr     |    mgmt_v6_gw     | mgmt_vlan | last_config_fetch |    current_mac    | model | traffic_vlan 
-----+--------------------+----------------+-----------------+-----------------+--------------+-----------------+--------------+---------------------+-------------------+-----------+-------------------+-------------------+-------+--------------
 447 | sw1-crew           | rs1.crew       | ge-0/0/39       | 151.216.183.66  |           27 | 151.216.183.65  |           64 | 2a02:ed02:1832::66  | 2a02:ed02:1832::1 |       666 |                   | 44:f4:77:69:4d:41 |       |         1701
 442 | sw2-gamestudio     | rs1.north      | ge-0/0/45       | 151.216.183.230 |           27 | 151.216.183.225 |           64 | 2a02:ed02:1837::230 | 2a02:ed02:1837::1 |       666 |                   | 44:f4:77:69:5d:41 |       |          229
 435 | sw1-south          | rs1.south      | ge-0/0/45       | 151.216.183.98  |           27 | 151.216.183.97  |           64 | 2a02:ed02:1836::98  | 2a02:ed02:1836::1 |       666 |                   | 44:f4:77:69:49:81 |       |          234
 434 | sw8-creativia      | rs1.distro6    | ge-0/0/25       | 151.216.181.155 |           26 | 151.216.181.129 |           64 | 2a02:ed02:181c::155 | 2a02:ed02:181c::1 |       666 |                   | 44:f4:77:69:1a:c1 |       |         2008
 420 | e83-1              | rs1.distro7    | ge-0/0/20       | 151.216.181.214 |           26 | 151.216.181.193 |           64 | 2a02:ed02:181d::214 | 2a02:ed02:181d::1 |       666 |                   | 44:f4:77:69:53:c1 |       |         1831
 419 | e81-2              | rs1.distro7    | ge-0/0/19       | 151.216.181.213 |           26 | 151.216.181.193 |           64 | 2a02:ed02:181d::213 | 2a02:ed02:181d::1 |       666 |                   | 44:f4:77:69:4b:81 |       |         1812
 418 | e81-1              | rs1.distro7    | ge-0/0/18       | 151.216.181.212 |           26 | 151.216.181.193 |           64 | 2a02:ed02:181d::212 | 2a02:ed02:181d::1 |       666 |                   | 44:f4:77:68:eb:c1 |       |         1811
 417 | e79-4              | rs1.distro6    | ge-0/0/17       | 151.216.181.147 |           26 | 151.216.181.129 |           64 | 2a02:ed02:181c::147 | 2a02:ed02:181c::1 |       666 |                   | 44:f4:77:69:02:c1 |       |         1794
```


**Connect to DB from CLI**
```
j@lappie:~/git/tgmanage$ psql -U bootstrap -d bootstrap -W
Password for user bootstrap: 
psql (9.3.5)
Type "help" for help.

bootstrap=> 
```
