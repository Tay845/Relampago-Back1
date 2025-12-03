const express = require("express");
const router = express.Router();
const db = require("../Config/database");

/*****************************************
 * 1. OBTENER CATÁLOGOS REALES
 *****************************************/
router.get("/catalogos", async (req, res) => {
  try {
    const [proyectos] = await db.pool.query("SELECT * FROM tipo_proyecto");
    const [calidades] = await db.pool.query("SELECT * FROM calidad");

    res.json({ proyectos, calidades });

  } catch (err) {
    res.status(500).json({ error: "Error obteniendo catálogos", details: err });
  }
});

/*****************************************
 * 2. OBTENER MATERIALES PERSONALIZADOS
 *****************************************/
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.pool.query(`
      SELECT material_id, tipo, nombre, unidad, precio, proyecto, descripcion, fecha_creacion
      FROM material_personalizado
      ORDER BY fecha_creacion DESC
    `);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: "Error obteniendo materiales", details: err });
  }
});

/*****************************************
 * 3. AGREGAR MATERIAL PERSONALIZADO (SIN tipo_material_id)
 *****************************************/
router.post("/", async (req, res) => {
  try {
    console.log("BODY RECIBIDO:", req.body);

    const { tipo, nombre, unidad, precio, proyecto, descripcion } = req.body;

    if (!tipo || !nombre || !unidad || !precio || !proyecto) {
      console.log("ERROR: Datos incompletos");
      return res.status(400).json({ error: "Datos incompletos" });
    }

    await db.pool.query(
      `INSERT INTO material_personalizado
       (tipo, nombre, unidad, precio, proyecto, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tipo, nombre, unidad, precio, proyecto, descripcion]
    );

    console.log(" MATERIAL INSERTADO");

    res.json({ message: "Material agregado exitosamente" });

  } catch (err) {
    console.log("ERROR MYSQL:", err);
    res.status(500).json({ error: "Error agregando material", details: err });
  }
});

/*****************************************
 * 4. EDITAR MATERIAL PERSONALIZADO (SIN tipo_material_id)
 *****************************************/
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, nombre, unidad, precio, proyecto, descripcion } = req.body;

    await db.pool.query(
      `UPDATE material_personalizado
       SET tipo=?, nombre=?, unidad=?, precio=?, proyecto=?, descripcion=?
       WHERE material_id=?`,
      [tipo, nombre, unidad, precio, proyecto, descripcion, id]
    );

    res.json({ message: "Material actualizado" });

  } catch (err) {
    res.status(500).json({ error: "Error editando material", details: err });
  }
});

/*****************************************
 * 5. ELIMINAR MATERIAL PERSONALIZADO
 *****************************************/
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.pool.query("DELETE FROM material_personalizado WHERE material_id=?", [id]);

    res.json({ message: "Material eliminado" });

  } catch (err) {
    res.status(500).json({ error: "Error eliminando material", details: err });
  }
});

/*****************************************
 * 6. CALCULAR PRESUPUESTO (USA material_base)
 *****************************************/
router.post("/calcular", async (req, res) => {
  try {
      let { id_tipo_proyecto, id_calidad, area_m2, pisos } = req.body;

      // Convertir a números
      area_m2 = Number(area_m2);
      pisos = Number(pisos);

      if (!id_tipo_proyecto || !id_calidad || !area_m2 || !pisos) {
          return res.status(400).json({ error: "Faltan datos para calcular" });
      }

      const [materiales] = await db.pool.query(
          `SELECT *
           FROM material_base
           WHERE tipo_proyecto_id=? AND calidad_id=?`,
          [id_tipo_proyecto, id_calidad]
      );

      let total = 0;
      const detalle = [];

      materiales.forEach(m => {
          const cantidad = (m.cantidad * area_m2 * pisos) / 100;
          const subtotal = cantidad * m.precio_unitario;
          total += subtotal;

          detalle.push({
              nombre_material: m.nombre,
              unidad: m.unidad,
              cantidad: Number(cantidad),
              precio_unitario: Number(m.precio_unitario),
              subtotal: Number(subtotal)
          });
      });

      res.json({
          total,
          costo_m2: total / area_m2,
          detalle
      });

  } catch (err) {
      console.error("Error en calcular presupuesto:", err);
      res.status(500).json({ error: "Error calculando presupuesto", details: err });
  }
});

/*****************************************
 * 7. GUARDAR PRESUPUESTO EN BASE
 *****************************************/
router.post("/guardar-presupuesto", async (req, res) => {
  const conn = await db.pool.getConnection();

  try {
    const {
      id_tipo_proyecto,
      id_calidad,
      area_m2,
      pisos,
      total,
      detalle
    } = req.body;

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO presupuesto 
        (area, pisos, tipo_proyecto_id, calidad_id, total_calculado)
       VALUES (?, ?, ?, ?, ?)`,
      [area_m2, pisos, id_tipo_proyecto, id_calidad, total]
    );

    const presupuesto_id = result.insertId;

    for (const item of detalle) {
      await conn.query(
        `INSERT INTO presupuesto_detalle
          (presupuesto_id, nombre_material, cantidad, unidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          presupuesto_id,
          item.nombre_material,
          item.cantidad,
          item.unidad,
          item.precio_unitario,
          item.subtotal
        ]
      );
    }

    await conn.commit();
    res.json({ message: "Presupuesto guardado", presupuesto_id });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Error guardando presupuesto", details: err });

  } finally {
    conn.release();
  }
});

module.exports = router;
