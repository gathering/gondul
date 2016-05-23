<?php

    /*
        Ugliest implementation of a kind of ipcalc... FULHAX
    */
    function find_v4_def_route($subnet){
        $subnet = array_shift(explode('/', $subnet));
        $octets = explode('.', $subnet);
        $octets[3]++;
        return implode('.', $octets);
    }
    function find_v6_def_route($subnet){
        $subnet = array_shift(explode('/', $subnet));
        return str_replace('::', '::1', $subnet);
    }
    
    function x($input){
        $parts = explode('.', $input);
        if($parts[3] > 192){
            $last = '193';
        }elseif($parts[3] > 128){
            $last = '129';
        }elseif($parts[3] > 64){
            $last = '65';
        }else{
            $last = '1';
        }
        
        return $parts[0] . '.' . $parts[1] . '.' . $parts[2] . '.' . $last;
    }
    

    require('../pg_connect.php');

    $switches_array = file('switches.txt');
    $patchlist_array = file('patchlist.txt');
    
    /*
        switches.txt: e41-3 88.92.15.64/26 2a06:5840:15b::/64 88.92.55.66/26 2a06:5840:55b::66/64 1413 distro5
        patchlist.txt: e7-2 distro1 ge-0/0/2 ge-1/0/2 ge-2/0/2
    */
    
    $d1 = array(); # dataset
    foreach($patchlist_array as $line){
        $t = array(); # temp array in this loop
        list($switch, $t['distro'], $t['distro_port_0'], $t['distro_port_1'], $t['distro_port_2']) = explode(' ', $line);
        $t = array_map('trim', $t);
        $d1[$switch] = $t;
    }
    
    $d2 = array(); # dataset
    foreach($switches_array as $line){
        $t = array(); # temp array in this loop
        list($t['switch'], $t['v4_subnet'], $t['v6_subnet'], $t['mgmt_v4_addr'], $t['mgmt_v6_addr'], $t['vlan']) = explode(' ', $line);
        $t = array_map('trim', $t);
        $d2[$t['switch']] = $t;
    }
    $d = array_merge_recursive($d1, $d2);
    # var_dump($d);
    
    foreach($d as $switch => $prop){
        $q = '
            UPDATE switches SET
                distro_phy_port = \'' . pg_escape_string($prop['distro_port_0']) . '\',
                traffic_vlan = \'' . pg_escape_string($prop['vlan']) . '\',
                mgmt_v4_gw = \'' . pg_escape_string(x($prop['mgmt_v4_addr'])) . '\'
            WHERE sysname = \'' . pg_escape_string($switch) . '\'';
            
        # var_dump($q);
        
        $result = pg_query($dbconn, $q);
        if (!$result){
            echo 'NOPE: ' . $q . "\n";
            exit;
        }
        
    }
    echo 'done! - no errors';
?>
