# HTTPD

Well, not working out quite as I've hoped (at least for now).

Resorted to Apache2, PHP and Postgres for the HTTP. Apache starts at boot, so no action required to get the stack up and after installation.

```
j@lappie:~/git/tgmanage$ cat /etc/apache2/sites-enabled/000-default.conf
<VirtualHost *:80>
        ServerAdmin webmaster@localhost

        DocumentRoot /home/j/git/tgmanage/fap/httpd/httpd_root/

        <Directory /home/j/git/tgmanage/fap/httpd/httpd_root>
                Options Indexes FollowSymLinks MultiViews
                AllowOverride All
                Require all granted
        </Directory>

	ErrorLog ${APACHE_LOG_DIR}/error.log
	LogLevel warn

	CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```
