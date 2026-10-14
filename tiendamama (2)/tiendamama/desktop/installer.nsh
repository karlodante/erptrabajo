# Resolución de icono app
# Usamos un icono sencillo (por defecto un lechita / comercio). Si existe
# assets/icon.ico se usa ese, sino el .png que provee electron-builder convierte.

; Instrucciones personalizadas para instalador NSIS
; - Genera el menú Inicio + acceso directo escritorio
; - Asocia el protocolo tiendamama:// (para integraciones futuras)
; - Verifica requisitos de espacio y escritura

!macro customInstall
  CreateDirectory "$APPDATA\TiendaMama"
  SetOutPath "$APPDATA\TiendaMama"
  ; Archivo sqlite portable (si usa sqlite) se crea al primer arranque.
!macroend

!macro customUnInstall
  RMDir /r "$APPDATA\TiendaMama"
!macroend
