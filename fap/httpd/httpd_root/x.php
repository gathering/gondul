<?php
    if(isset($_GET['mode'])){
        function log_to_file($text){
            $out = date('c') . ' - ' . $_SERVER['REMOTE_ADDR'] . ' - ' . $text . "\n";
            file_put_contents('../../logs/httpd.log', $out, FILE_APPEND);
        }

        if($_GET['mode'] === 'config'){
            # LASTE NED CONFIG
            /*
            header('Content-Description: File Transfer');
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename='.basename($file));
            header('Content-Length: ' . filesize('../files/' . $_GET['file']));
            */
            
            # File containing pg_connect() with DB credentials - excluded for GIT safety
            require 'pg_connect.php';
            
            
            $template = 'ex2200.template'; # default template
            
            $pieces = explode('/', $_GET['hostname']);
            if(count($pieces) == 2){
                $_GET['hostname'] = $pieces[0];
                if($pieces[1] == 'secure'){
                    $template = 'ex2200_secure.template';
                }
            }


            // Performing SQL query
            $query = 'SELECT * FROM switches WHERE hostname = \'' . $_GET['hostname'] . '\'';
            $result = pg_query($query) or die('Query failed: ' . pg_last_error());
            if(pg_num_rows($result) == 1){
                $c = pg_fetch_assoc($result);
                include $template;
                log_to_file('Served ' . $template . ' to client');
            }else{
                log_to_file('Hostname not found in DB');
                header("HTTP/1.0 404 Not Found");
                exit();
            }
            
        }elseif($_GET['mode'] === 'image'){
            if(isset($_GET['file']) && is_readable('../files/' . $_GET['file'])){
                # SEND IMAGE
                header('Content-Description: File Transfer');
                header('Content-Type: application/octet-stream');
                header('Content-Disposition: attachment; filename='.basename($file));
                header('Content-Length: ' . filesize('../files/' . $_GET['file']));
                
                $time_start = microtime(true);
                $bytes = readfile('../files/' . $_GET['file']);
                $time_end = microtime(true);
                $time = $time_end - $time_start;
                
                log_to_file('Transferred "' . $_GET['file'] . '" in ' . round($time, 2) . 'sec (' . round(($bytes/$time)/(1024*128), 2) . 'Mbit/s)');
            }else{
                log_to_file('404 - File not found');
                header("HTTP/1.1 404 Not Found");
                exit();
            }

        }
    }
?>
