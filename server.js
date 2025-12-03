const express = require('express');
const cors = require('cors');

const { pool } = require('./Config/database');
const materialesRoutes = require('./Routes/Materiales');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas API
app.use('/api/materiales', materialesRoutes);

// Ruta de prueba
app.get('/ping', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW() AS fecha');
        res.json({
            mensaje: 'Servidor funcionando correctamente',
            fecha: rows[0].fecha
        });
    } catch (err) {
        console.error('Error en consulta:', err);
        res.status(500).json({ error: 'Error en consulta a MySQL' });
    }
});

// Render asigna el puerto automáticamente
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, () => {
    console.log("Servidor corriendo correctamente en el puerto" %{PORT});
});