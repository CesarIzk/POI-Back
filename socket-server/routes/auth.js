const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

// ─── POST /api/auth/login ───────────────────────────────────
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false, message: "Campos incompletos" });
    }

    try {
        // Llama al mismo SP que usaba PHP
        const [rows] = await db.query(
            "CALL SP_GestionarUsuario('LOGIN', NULL, NULL, ?, NULL, NULL, NULL, NULL)",
            [email]
        );

        const usuario = rows[0]?.[0];

        if (!usuario) {
            return res.json({ success: false, message: "Credenciales incorrectas" });
        }

        // Verificar password (igual que password_verify de PHP)
        const match = await bcrypt.compare(password, usuario.UPassword);
        if (!match) {
            return res.json({ success: false, message: "Credenciales incorrectas" });
        }

        // Generar JWT (reemplaza la sesión PHP)
        const payload = {
            id:        usuario.IdUsuario,
            nombre:    usuario.Nombre,
            email:     usuario.Email,
            nivel:     usuario.Nivel    ?? 1,
            puntos:    usuario.PuntoUs  ?? 0
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || "poi_secret", {
            expiresIn: "7d"
        });

        return res.json({
            success: true,
            token,
            usuario: payload
        });

    } catch (err) {
        console.error("Error login:", err);
        return res.json({ success: false, message: "Error del servidor" });
    }
});


// ─── POST /api/auth/register ────────────────────────────────
router.post("/register", async (req, res) => {
    const { nombre, email, telefono, password, alias, pais } = req.body;

    if (!nombre || !email || !password) {
        return res.json({ success: false, message: "Campos obligatorios incompletos" });
    }

    try {
        // Hashear contraseña (equivalente a password_hash de PHP)
        const passwordHash = await bcrypt.hash(password, 10);

        const [rows] = await db.query(
            "CALL SP_GestionarUsuario('INSERT', NULL, ?, ?, ?, ?, ?, ?)",
            [nombre, email, telefono || 0, passwordHash, alias || "", pais || "Mexico"]
        );

        const nuevoId = rows[0]?.[0]?.NuevoIdUsuario;

        if (nuevoId) {
            return res.json({ success: true, message: "Usuario registrado correctamente", id_usuario: nuevoId });
        } else {
            return res.json({ success: false, message: "No se pudo registrar el usuario" });
        }

    } catch (err) {
        console.error("Error register:", err);
        return res.json({ success: false, message: "Error del servidor", error: err.message });
    }
});

module.exports = router;