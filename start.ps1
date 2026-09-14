$brithidaPassword = Read-Host 'Contraseña privada del panel (mínimo 8 caracteres)' -AsSecureString
$brithidaPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($brithidaPassword))
if($brithidaPlain.Length -lt 8){ throw 'La contraseña debe tener al menos 8 caracteres.' }
$env:BRITHIDA_ADMIN_PASSWORD = $brithidaPlain
Write-Host 'Tienda: http://localhost:3000/'
Write-Host 'Panel:  http://localhost:3000/admin.html'
node server.mjs
