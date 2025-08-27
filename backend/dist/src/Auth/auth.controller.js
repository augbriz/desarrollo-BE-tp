import jwt from 'jsonwebtoken';
import { orm } from '../shared/orm.js';
import { Usuario } from '../Usuario/usuario.entity.js';
class AuthController {
    async login(req, res) {
        console.log('🔍 Login request recibido:', req.body);
        console.log('🔑 JWT_SECRET está configurado:', !!process.env.JWT_SECRET);
        try {
            const { mail, contrasenia } = req.body;
            console.log('📧 Mail:', mail, '🔒 Password length:', contrasenia ? contrasenia.length : 'undefined');
            // Validar que se enviaron los datos requeridos
            if (!mail || !contrasenia) {
                console.log('❌ Faltan datos requeridos');
                return res.status(400).json({
                    message: 'Email y contraseña son requeridos'
                });
            }
            // Buscar usuario por mail
            const em = orm.em.fork(); //esto crea una entidad separada por cada request para que no haya interferencia entre datos de los diferentes usuarios
            const usuario = await em.findOne(Usuario, { mail: mail });
            if (!usuario) {
                return res.status(401).json({
                    message: 'Credenciales inválidas'
                });
            }
            // Verificar contraseña usando el método ya existente
            const isValidPassword = await usuario.verificarContrasenia(contrasenia);
            if (!isValidPassword) {
                return res.status(401).json({
                    message: 'Credenciales inválidas'
                });
            }
            // Verificar que el ID existe (por seguridad)
            if (!usuario.id) {
                return res.status(500).json({
                    message: 'Error interno del servidor'
                });
            }
            // Generar JWT
            const payload = {
                id: usuario.id,
                mail: usuario.mail,
                nombre: usuario.nombre
            };
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ message: 'JWT_SECRET no configurado' });
            }
            const token = jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
            // Respuesta exitosa
            const response = {
                token,
                user: {
                    id: usuario.id,
                    mail: usuario.mail,
                    nombre: usuario.nombre
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({
                message: 'Error interno del servidor'
            });
        }
    }
    async register(req, res) {
        try {
            const { mail, contrasenia, nombre, nombreUsuario, fechaNacimiento } = req.body;
            // Validaciones básicas
            if (!mail || !contrasenia || !nombre || !nombreUsuario || !fechaNacimiento) {
                return res.status(400).json({
                    message: 'Todos los campos son requeridos'
                });
            }
            // Validar formato de email
            const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!mailRegex.test(mail)) {
                return res.status(400).json({
                    message: 'Formato de email inválido'
                });
            }
            // Validar longitud de contraseña
            if (contrasenia.length < 6) {
                return res.status(400).json({
                    message: 'La contraseña debe tener al menos 6 caracteres'
                });
            }
            // Validar longitud de nombre de usuario
            if (nombreUsuario.length < 3) {
                return res.status(400).json({
                    message: 'El nombre de usuario debe tener al menos 3 caracteres'
                });
            }
            // Validar longitud de nombre
            if (nombre.length < 2) {
                return res.status(400).json({
                    message: 'El nombre debe tener al menos 2 caracteres'
                });
            }
            // Verificar si el email ya existe
            const em = orm.em.fork();
            const existingUserByEmail = await em.findOne(Usuario, { mail: mail });
            if (existingUserByEmail) {
                return res.status(409).json({
                    message: 'El email ya está registrado'
                });
            }
            // Verificar si el nombre de usuario ya existe
            const existingUserByUsername = await em.findOne(Usuario, { nombreUsuario: nombreUsuario });
            if (existingUserByUsername) {
                return res.status(409).json({
                    message: 'El nombre de usuario ya está en uso'
                });
            }
            // Validar y parsear fecha de nacimiento
            const birthDate = new Date(fechaNacimiento);
            if (isNaN(birthDate.getTime())) {
                return res.status(400).json({
                    message: 'Formato de fecha de nacimiento inválido'
                });
            }
            // Verificar que la fecha de nacimiento sea válida (mayor de 13 años)
            const today = new Date();
            const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
            if (birthDate > minAge) {
                return res.status(400).json({
                    message: 'Debes ser mayor de 13 años para registrarte'
                });
            }
            // Crear nuevo usuario con todos los campos requeridos
            const nuevoUsuario = em.create(Usuario, {
                mail: mail,
                contrasenia: contrasenia,
                nombre: nombre,
                nombreUsuario: nombreUsuario,
                fechaNacimiento: birthDate,
                fechaCreacion: new Date()
            });
            await em.persistAndFlush(nuevoUsuario);
            // Verificar que el ID existe después de persistir
            if (!nuevoUsuario.id) {
                return res.status(500).json({
                    message: 'Error al crear usuario'
                });
            }
            // Generar JWT
            const payload = {
                id: nuevoUsuario.id,
                mail: nuevoUsuario.mail,
                nombre: nuevoUsuario.nombre
            };
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ message: 'JWT_SECRET no configurado' });
            }
            const token = jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
            // Respuesta exitosa
            const response = {
                token,
                user: {
                    id: nuevoUsuario.id,
                    mail: nuevoUsuario.mail,
                    nombre: nuevoUsuario.nombre
                }
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({
                message: 'Error interno del servidor'
            });
        }
    }
    // Endpoint para verificar si el token es válido
    async verifyToken(req, res) {
        try {
            res.status(200).json({
                message: 'Token válido',
                user: req.user
            });
        }
        catch (error) {
            console.error('Error en verificación:', error);
            res.status(500).json({
                message: 'Error interno del servidor'
            });
        }
    }
    // Endpoint para obtener el perfil completo del usuario autenticado
    //🛡️ "¿Tienes credencial válida?" ✅ "Sí, pasa" (esto es lo que hizo el middleware)
    //"¿Tu cuenta existe realmente?" "¿No fue cerrada?" "¿Los datos son correctos?" (esto es lo que hace el principio de getProfile)
    async getProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const em = orm.em.fork();
            const usuario = await em.findOne(Usuario, { id: userId });
            if (!usuario) {
                return res.status(404).json({ message: 'Usuario no encontrado' }); //Todas estas validaciones las hace porque si el
            }
            // Enviar datos del perfil sin la contraseña
            const perfil = {
                id: usuario.id,
                nombreUsuario: usuario.nombreUsuario,
                nombre: usuario.nombre,
                mail: usuario.mail,
                fechaNacimiento: usuario.fechaNacimiento,
                fechaCreacion: usuario.fechaCreacion
            };
            res.status(200).json(perfil);
        }
        catch (error) {
            console.error('Error al obtener perfil:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}
export { AuthController };
//# sourceMappingURL=auth.controller.js.map