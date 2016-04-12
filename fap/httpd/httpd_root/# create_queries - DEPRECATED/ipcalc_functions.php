<?php
    /*
        Mainly copied from djamps's work - https://github.com/djamps/php-ipv6-calculator/blob/master/ipcalc.php
        Edited by Jonas Lindstad for The Gathering 2015
        Licensed under GPL
    */
    
    
    
    // Convert array of short unsigned integers to binary
    function _packBytes($array) {
        foreach ( $array as $byte ) {
            $chars .= pack('C',$byte);
        }
        return $chars;
    }
    
    
    // Convert binary to array of short integers
    function _unpackBytes($string) {
        return unpack('C*',$string);
    }
    
    
    // Add array of short unsigned integers
    function _addBytes($array1,$array2) {
        $result = array();
        $carry = 0;
        foreach ( array_reverse($array1,true) as $value1 ) {
            $value2 = array_pop($array2);
            if ( empty($result) ) { $value2++; }
            $newValue = $value1 + $value2 + $carry;
            if ( $newValue > 255 ) {
                $newValue = $newValue - 256;
                $carry = 1;
            } else {
                $carry = 0;
            }
            array_unshift($result,$newValue);
        }
        return $result;
    }
    
    
    /* Useful Functions */
    function _cdr2Bin ($cdrin,$len=4){
        if ( $len > 4 || $cdrin > 32 ) { // Are we ipv6?
            return str_pad(str_pad("", $cdrin, "1"), 128, "0");
        } else {
            return str_pad(str_pad("", $cdrin, "1"), 32, "0");
        }
    }
    
    
    function _bin2Cdr ($binin){
        return strlen(rtrim($binin,"0"));
    }
    
    
    function _cdr2Char ($cdrin,$len=4){
        $hex = _bin2Hex(_cdr2Bin($cdrin,$len));
        return _hex2Char($hex);
    }
    
    
    function _char2Cdr ($char){
        $bin = _hex2Bin(_char2Hex($char));
        return _bin2Cdr($bin);
    }
    
    
    function _hex2Char($hex){
        return pack('H*',$hex);
    }
    
    
    function _char2Hex($char){
        $hex = unpack('H*',$char);
        return array_pop($hex);
    }
    
    
    function _hex2Bin($hex){
        $bin='';
        for($i=0;$i<strlen($hex);$i++)
            $bin.=str_pad(decbin(hexdec($hex{$i})),4,'0',STR_PAD_LEFT);
        return $bin;
    }
    
    
    function _bin2Hex($bin){
        $hex='';
        for($i=strlen($bin)-4;$i>=0;$i-=4)
            $hex.=dechex(bindec(substr($bin,$i,4)));
        return strrev($hex);
    }
    
    /*
        Converts a v4/v6 subnet to the first usable IP
    */
    function net_to_gw($net){
        $maxSubNets = '2048'; // Stop memory leak from invalid input or large ranges
        $charHost = inet_pton(strtok($net, '/'));
        $charMask = _cdr2Char(strtok('/'),strlen($charHost));
        $charHostMask = substr(_cdr2Char(127),-strlen($charHost));
        $charNet = $charHost & $charMask; // Supernet network address
        $charHostMin = $charNet | ~$charHostMask;
        return inet_ntop($charHostMin);
    }
    
    
    





/*

    $maxSubNets = '2048'; // Stop memory leak from invalid input or large ranges
    $superNet = '2a02:ed02:180a::13/64';
    if (ereg('/',$superNet)){ //if cidr type mask
        $charHost = inet_pton(strtok($superNet, '/'));
        $charMask = _cdr2Char(strtok('/'),strlen($charHost));
    }
    
    $charHostMask = substr(_cdr2Char(127),-strlen($charHost));
    $charNet = $charHost & $charMask; // Supernet network address
    $charHostMin = $charNet | ~$charHostMask;
    echo 'Første brukbare adresse i ' . $superNet . ': ';
    echo inet_ntop($charHostMin);
*/
    
?>
