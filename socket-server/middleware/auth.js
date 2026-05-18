const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
    const header = req.headers["authorization"];

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No autorizado" });
    }

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "poi_secret");
        req.usuario = decoded; // { id, nombre, email }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Token inválido" });
    }
};