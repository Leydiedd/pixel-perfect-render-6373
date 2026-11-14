# Iniciar Bimbo en Wi-Fi o con datos compartidos del celular

1. Conecta la laptop a la red que vas a usar. Si compartes datos, activa la zona Wi-Fi del celular y conecta la laptop a ella.
2. En XAMPP, enciende Apache y MySQL.
3. Abre INICIAR-BIMBO.cmd en la carpeta del proyecto.
4. Espera el mensaje SISTEMA INICIADO. Allí aparecen Tienda, Administración y Dolibarr.
5. Desde la laptop usa el enlace localhost. Desde el celular usa el enlace de la IP de red detectada.

Los enlaces se guardan también en .local/enlaces-bimbo.txt. Conserva la ventana de inicio abierta. Para detener la web, pulsa Ctrl+C. No abras varias instancias a la vez.

Si cambias de Wi-Fi o conectas la zona Wi-Fi después de iniciar, detén la web y vuelve a abrir INICIAR-BIMBO.cmd. Se vuelve a detectar la red. El sistema avisa si pierde la IP, sin reiniciarse en mitad de un pedido.

La web intenta el puerto 5173; si está ocupado, utiliza uno libre hasta el 5183. No detiene otras aplicaciones. Dolibarr usa el puerto 8081 para la red local; su acceso anterior por 127.0.0.1 sigue disponible.

Se prioriza una red física con puerta de enlace, evitando VPN y adaptadores virtuales. Si tienes varias redes físicas y quieres elegir una, puedes iniciar desde PowerShell:

    $env:BIMBO_LAN_IP = 'IP_PRIVADA_DE_ESTA_LAPTOP'
    node scripts/serve-lan.mjs

No pongas literalmente el texto del ejemplo; usa una IP asignada a esta laptop. Normalmente no necesitas esta opción.

## Después de modificar el código

INICIAR-BIMBO.cmd utiliza la versión ya compilada (la genera si falta). Para actualizarla después de editar código, con la web detenida ejecuta:

    npm run start:lan

Este comando compila y arranca con la misma detección automática.

## Otra laptop

Este cambio no traslada la base de datos. Primero debes restaurar la web, Dolibarr, base de datos y documentos, e instalar Node y XAMPP como se explicó para la migración.

Para acceso desde celular, la otra laptop también necesita la configuración de Apache de scripts/httpd-bimbo-wifi.conf (ajustando las rutas si XAMPP no está en C:/xampp) e incluirla desde httpd.conf. Conserva los otros sitios de XAMPP como locales. Verifica Apache con httpd.exe -t antes de reiniciarlo.

Ejecuta una sola vez scripts/configurar-red-local.ps1 como administrador para crear reglas limitadas a la subred local, para Node 5173-5183 y Apache 8081. La configuración actual ya está aplicada en esta laptop. El script deja el resultado en .local/configurar-red-local.log.

El punto de acceso del celular puede tener aislamiento de dispositivos según el modelo. Si impide entrar desde el teléfono, comprueba primero el enlace localhost en la laptop y prueba otro dispositivo conectado a esa misma zona Wi-Fi. No se necesita abrir puertos del router ni publicar el sistema en Internet.

El chatbot requiere Internet. El resto de la aplicación usa los servicios locales.