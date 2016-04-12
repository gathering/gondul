<?php
    /*
        Used for generating SQL queries for FAP
        Jonas Lindstad for TG15
        GPL V2
    */
    
    chdir(__DIR__); # sets the executing directory to be the path of this script - necessary for CLI require() usage
    header("Content-Type: text/plain");
    
    require 'ipcalc_functions.php';
    /*
        Load data sources
    */
    $patchlist = file('patchlist.txt');
    $switches = file('switches.txt');
    
    $dataset = array();
    
    foreach($patchlist as $lines){
        $pieces = explode(' ', trim($lines));
        $dataset[$pieces[0]] = array(
            'hostname' => $pieces[0],
            'distro_name' => 'rs1.' . $pieces[1], # prefix with "rs." so we get "rs1.distro0" syntax
            'distro_phy_port' => $pieces[2]
        );
    }
    
    /*
        Assign to logical and usable names in array
    */
    foreach($switches as $lines){
        $pieces = explode(' ', trim($lines));
        $dataset[$pieces[0]]['mgmt_v4_addr'] = explode('/', $pieces[3])[0];
        $dataset[$pieces[0]]['mgmt_v4_cidr'] = explode('/', $pieces[3])[1];
        $dataset[$pieces[0]]['mgmt_v4_gw'] = net_to_gw($pieces[3]);
        $dataset[$pieces[0]]['mgmt_v6_addr'] = explode('/', $pieces[4])[0];
        $dataset[$pieces[0]]['mgmt_v6_cidr'] = explode('/', $pieces[4])[1];
        $dataset[$pieces[0]]['mgmt_v6_gw'] = net_to_gw($pieces[4]);
        $dataset[$pieces[0]]['traffic_vlan'] = $pieces[5];
        $dataset[$pieces[0]]['mgmt_vlan'] = '666';
    }
    
    /*
        Prints the query rows
    */
    $sql_query = '';
    foreach($dataset as $k => $v){
        $columns = implode(', ', array_keys($v));
        $values = "'" . implode("', '", array_values($v)) . "'";
        $sql_query .= 'INSERT INTO switches (' . $columns . ') VALUES (' . $values . ');' . "\n";
    }
    
    echo $sql_query;
?>
