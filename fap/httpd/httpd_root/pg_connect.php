<?php
    if(!$dbconn = pg_connect("host=localhost dbname=fap user=fap password=<sensored>")){
        echo 'Could not connect:' . pg_last_error();
        exit();
    }
?>
