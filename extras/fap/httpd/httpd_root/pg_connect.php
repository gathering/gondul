<?php
    if(!$dbconn = pg_connect("host=<host> dbname=<db> user=<user> password=<password>")){
        echo 'Could not connect:' . pg_last_error();
        exit();
    }
?>
