<?php
    $community = '<sensored>';
    
    /*
        Loopbacks: 151.216.255.0/24
    */
    $ips = array();
    foreach(range(1, 254) as $n){
        $ips[] = '151.216.255.' . $n;
    }
    
    /*
        mgmt nets
    */
    foreach(range(180, 184) as $range){
        foreach(range(2, 254) as $n){ # skips .1, which is the distro
            $ips[] = '151.216.' . $range . '.' . $n;
        }
    }

    $n = 1;
    foreach($ips as $ip){
        $hostname = @snmpget($ip, $community, '.1.3.6.1.2.1.1.5.0', 50000);
        if($hostname) {
            $sysdescr = snmpget($ip, $community, '.1.3.6.1.2.1.1.1.0', 50000);
            if(substr($sysdescr, 0, 30) === 'STRING: Juniper Networks, Inc.'){
                $model = explode(' ', substr($sysdescr, 30))[1];
            }else{
                $model = 'unknown_model';
            }
            
            # Sample string: STRING: Juniper Networks, Inc. ex3300-48p Ethernet Switch, kernel JUNOS 14.1X53-D15.2, Build date: 2014-12-21 02:50:15 UTC Copyright (c) 1996-2014 Juniper Networks, Inc.
            preg_match('/[0-9]{2}\.[0-9]{1}X[0-9]{2}-[A-Z]{1}[0-9]{2}\.[0-9]{1}/', $sysdescr, $regex_matches);
            
            if(isset($regex_matches[0])){
                $version = $regex_matches[0];
            }else{
                $version = 'unknown_firmware';
            }


            # 14.1X53-D15.2

            echo substr($hostname, 8) . ' ' . $ip . ' ' . $model . ' ' . $version;
            echo "\n";
        }
    }
?>
