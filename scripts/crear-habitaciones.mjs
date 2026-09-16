/**
 * Crea (o actualiza) el catálogo de habitaciones de Medina Elvira, la única
 * sede que tiene habitaciones hoy. Lista tal cual la dio Fran (número de
 * camas/literas como comentario, solo para referencia: el CRM solo guarda
 * el nombre y la capacidad).
 *
 * Está escrito en JavaScript plano a propósito, igual que crear-admin.mjs:
 * así funciona igual en un portátil y dentro del contenedor de producción.
 *
 * Uso en local:
 *     npm run db:seed:habitaciones
 *
 * Uso en el servidor (Docker):
 *     docker compose exec app node scripts/crear-habitaciones.mjs
 *
 * Seguro de ejecutar varias veces: cada habitación se identifica por su
 * centro + nombre, así que volver a ejecutarlo actualiza los datos en vez
 * de duplicar filas.
 */
import { PrismaClient } from "@prisma/client";

const CENTRO = "MEDINA_ELVIRA";

// activa: false = bloqueada / cerrada (por obras o sin datos todavía).
// capacidad: 0 en las bloqueadas de las que no se conoce ni el número de
// camas, para que no cuenten en la capacidad total de la residencia.
const HABITACIONES = [
  // 101-107: bloqueadas, capacidad todavía desconocida.
  { nombre: "101", capacidad: 0, activa: false },
  { nombre: "102", capacidad: 0, activa: false },
  { nombre: "103", capacidad: 0, activa: false },
  { nombre: "104", capacidad: 0, activa: false },
  { nombre: "105", capacidad: 0, activa: false },
  { nombre: "106", capacidad: 0, activa: false },
  { nombre: "107", capacidad: 0, activa: false },
  { nombre: "108", capacidad: 2, activa: true }, // 2 camas
  { nombre: "109", capacidad: 1, activa: true }, // 1 cama
  { nombre: "110", capacidad: 5, activa: false }, // cerrada por obras, camas sin determinar
  { nombre: "111", capacidad: 4, activa: true }, // 2 literas
  { nombre: "112", capacidad: 5, activa: true }, // 2 literas y 1 cama
  { nombre: "113", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "114", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "115", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "116", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "117", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "118", capacidad: 0, activa: false }, // bloqueada
  { nombre: "119", capacidad: 0, activa: false }, // bloqueada
  { nombre: "120", capacidad: 3, activa: true }, // 1 cama y 1 litera
  { nombre: "121", capacidad: 3, activa: true }, // 3 camas
  { nombre: "122", capacidad: 4, activa: true }, // 4 camas
  { nombre: "123", capacidad: 4, activa: true }, // 4 camas
  { nombre: "124", capacidad: 5, activa: true }, // 3 camas
  { nombre: "125", capacidad: 5, activa: true }, // 5 camas
  { nombre: "126", capacidad: 2, activa: true }, // 2 camas
  { nombre: "127", capacidad: 4, activa: true }, // 3 camas
  { nombre: "128", capacidad: 4, activa: true }, // 3 camas
  { nombre: "129", capacidad: 4, activa: true }, // 4 camas
  { nombre: "130", capacidad: 4, activa: true }, // 1 cama y 2 literas
  { nombre: "131", capacidad: 6, activa: true }, // 2 camas y 2 literas
  { nombre: "132", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "133", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "134", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "135", capacidad: 3, activa: true }, // 1 cama y 1 litera
  { nombre: "136", capacidad: 2, activa: true }, // 1 litera
  // 137-144: bloqueadas, igual que 101-107 (capacidad todavía desconocida).
  // El plano real de la 1ª planta no llega más allá de la 144: la 145-147
  // no existen en el edificio, se quitaron al comprobarlo contra el plano.
  { nombre: "137", capacidad: 0, activa: false },
  { nombre: "138", capacidad: 0, activa: false },
  { nombre: "139", capacidad: 0, activa: false },
  { nombre: "140", capacidad: 0, activa: false },
  { nombre: "141", capacidad: 0, activa: false },
  { nombre: "142", capacidad: 0, activa: false },
  { nombre: "143", capacidad: 0, activa: false },
  { nombre: "144", capacidad: 0, activa: false },
  // 2ª planta: 3 camas y 1 litera, ocupación 5.
  { nombre: "201", capacidad: 5, activa: true },
  { nombre: "202", capacidad: 5, activa: true },
  { nombre: "204", capacidad: 5, activa: true },
  { nombre: "206", capacidad: 5, activa: true },
  { nombre: "210", capacidad: 5, activa: true },
  { nombre: "211", capacidad: 5, activa: true },
  { nombre: "212", capacidad: 5, activa: true },
  { nombre: "215", capacidad: 5, activa: true },
  { nombre: "216", capacidad: 5, activa: true },
  { nombre: "217", capacidad: 5, activa: true },
  { nombre: "218", capacidad: 5, activa: true },
  { nombre: "220", capacidad: 5, activa: true },
  { nombre: "223", capacidad: 5, activa: true },
  { nombre: "224", capacidad: 5, activa: true },
  { nombre: "226", capacidad: 5, activa: true },
  { nombre: "227", capacidad: 5, activa: true },
  { nombre: "228", capacidad: 5, activa: true },
  { nombre: "233", capacidad: 5, activa: true },
  { nombre: "234", capacidad: 5, activa: true },
  { nombre: "235", capacidad: 5, activa: true },
  { nombre: "236", capacidad: 5, activa: true },
  { nombre: "237", capacidad: 5, activa: true },
  { nombre: "244", capacidad: 5, activa: true },
  { nombre: "203", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "214", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "219", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "231", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "238", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "239", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "240", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "241", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "242", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "243", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "205", capacidad: 3, activa: true, nevera: true }, // 1 cama y 1 litera
  { nombre: "213", capacidad: 2, activa: true }, // 2 camas
  { nombre: "221", capacidad: 6, activa: true }, // 6 camas (apartamento)
  { nombre: "225", capacidad: 5, activa: true }, // 3 camas y 1 litera (cortina ducha)
  { nombre: "229", capacidad: 5, activa: true }, // 1 cama y 2 literas (aseo minusválidos)
  { nombre: "230", capacidad: 5, activa: true }, // 3 camas y 1 litera (aseo minusválidos)
  { nombre: "232", capacidad: 5, activa: true }, // 3 camas y 1 litera
  // 3ª planta.
  { nombre: "301", capacidad: 6, activa: true }, // 2 camas y 2 literas
  { nombre: "302", capacidad: 6, activa: true }, // 2 camas y 2 literas
  { nombre: "303", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "304", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "305", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "306", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "307", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "308", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "309", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "310", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "311", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "312", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "313", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "314", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "315", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "316", capacidad: 3, activa: true, nevera: true }, // 2 camas y 1 litera (nevera y microondas)
  { nombre: "317", capacidad: 3, activa: true }, // 2 camas y 1 litera
  { nombre: "318", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "319", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "320", capacidad: 5, activa: true }, // 2 camas y 1 litera
  { nombre: "321", capacidad: 6, activa: true }, // 2 camas y 2 literas
  { nombre: "322", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "323", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "324", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "325", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "326", capacidad: 4, activa: true }, // 1 cama y 1 litera
  { nombre: "327", capacidad: 4, activa: true }, // 1 cama y 1 litera
  { nombre: "328", capacidad: 6, activa: true }, // 2 camas y 2 literas
  { nombre: "329", capacidad: 5, activa: true }, // 1 cama y 2 literas
  { nombre: "330", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "331", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "332", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "333", capacidad: 5, activa: true }, // 3 camas y 2 literas
  { nombre: "334", capacidad: 6, activa: true }, // 4 camas y 1 litera
  { nombre: "335", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "336", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "337", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "338", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "339", capacidad: 4, activa: true }, // 2 camas y 1 litera
  { nombre: "340", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "341", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "342", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "343", capacidad: 5, activa: true }, // 3 camas y 1 litera
  { nombre: "344", capacidad: 2, activa: true, nevera: true }, // 2 camas (televisión y nevera, apartamento)
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const h of HABITACIONES) {
      // Las habitaciones de profesorado son las que tienen nevera (316 y
      // 344, hasta ahora): el resto no la tiene.
      const tieneNevera = h.nevera ?? false;
      await prisma.habitacion.upsert({
        where: { centroNovaschool_nombre: { centroNovaschool: CENTRO, nombre: h.nombre } },
        create: {
          nombre: h.nombre,
          capacidad: h.capacidad,
          activa: h.activa,
          tieneNevera,
          centroNovaschool: CENTRO,
        },
        update: { capacidad: h.capacidad, activa: h.activa, tieneNevera },
      });
    }
    console.log(`Listo: ${HABITACIONES.length} habitaciones de Medina Elvira creadas/actualizadas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
