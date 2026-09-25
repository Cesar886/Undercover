#!/usr/bin/env node

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.production'));
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const POST_COUNT = Number.parseInt(process.env.DEMO_POSTS || '260', 10);
const COMMENT_COUNT = Number.parseInt(process.env.DEMO_COMMENTS || '780', 10);
const REPLY_COUNT = Number.parseInt(process.env.DEMO_REPLIES || '1800', 10);
const AUTHOR_COUNT = Number.parseInt(process.env.DEMO_AUTHORS || '90', 10);
const BACKFILL_REACTIONS = process.env.DEMO_BACKFILL_REACTIONS !== 'false';
const CLEAN_UNSUPPORTED_REACTIONS = process.env.DEMO_CLEAN_UNSUPPORTED_REACTIONS !== 'false';
const RESET_DEMO_REACTIONS = process.env.DEMO_RESET_DEMO_REACTIONS !== 'false';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el entorno o en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const extraCategories = [
  ['quemones-vip', 'Quemones VIP', 'Los chismes que traen recibos'],
  ['infieles-en-la-u', 'Infieles en la U', 'Historias de doble vida estudiantil'],
  ['cafeteria-drama', 'Cafeteria Drama', 'Todo lo que se escucha entre mesas'],
  ['biblioteca-secreta', 'Biblioteca Secreta', 'Susurros entre apuntes y miradas'],
  ['exposed-soft', 'Exposed Soft', 'Quemones sin nombres reales'],
  ['red-flags', 'Red Flags', 'Senales que todos vimos tarde'],
  ['amores-turbios', 'Amores Turbios', 'Relaciones que parecen materia dificil'],
  ['ligues-fallidos', 'Ligues Fallidos', 'Intentos romanticos que salieron chistosos'],
  ['roomies', 'Roomies', 'Historias de casa compartida'],
  ['grupos-de-whatsapp', 'Grupos de WhatsApp', 'Mensajes que cambian de tono fuera de contexto'],
  ['semestre-maldito', 'Semestre Maldito', 'Cuando todo se junta'],
  ['profes-intensos', 'Profes Intensos', 'Tareas, indirectas y parciales sorpresa'],
  ['parejas-sospechosas', 'Parejas Sospechosas', 'Cuando algo no cuadra'],
  ['after-party', 'After Party', 'Lo que nadie admite el lunes'],
  ['crushes-anonimos', 'Crushes Anonimos', 'Confesiones sin remitente'],
  ['traiciones-light', 'Traiciones Light', 'Promesas rotas y versiones encontradas'],
  ['chismes-del-pasillo', 'Chismes del Pasillo', 'Versiones que cambian caminando'],
  ['deudas-y-promesas', 'Deudas y Promesas', 'Prestamos que se volvieron novela'],
  ['quien-fue', 'Quien Fue', 'Misterios pequenos de campus'],
  ['amistades-rotas', 'Amistades Rotas', 'Cuando el grupo se divide'],
  ['doble-check', 'Doble Check', 'Mensajes vistos y no contestados'],
  ['capturas-falsas', 'Capturas y Recibos', 'Mensajes que nadie queria que salieran del chat'],
  ['indirectas', 'Indirectas', 'Para decir sin decir'],
  ['cosas-de-ex', 'Cosas de Ex', 'Historias que ya deberian superarse'],
  ['team-chisme', 'Team Chisme', 'Comentarios de espectadores profesionales'],
  ['anonimos-picantes', 'Anonimos Picantes', 'Drama subido de tono sin datos reales'],
  ['laboratorio-social', 'Laboratorio Social', 'Experimentos de convivencia'],
  ['parcial-de-drama', 'Parcial de Drama', 'Examen sorpresa de paciencia'],
  ['patio-central', 'Patio Central', 'Todo mundo pasa y todo mundo opina'],
  ['no-era-mi-novia', 'No Era Mi Novia', 'Excusas clasicas del multiverso'],
  ['citas-raras', 'Citas Raras', 'Planes que no salieron como se esperaba'],
  ['el-recibo', 'El Recibo', 'Cuando aparece el mensaje que cambia toda la historia'],
  ['modo-detective', 'Modo Detective', 'Investigaciones exageradas'],
  ['te-lo-dije', 'Te Lo Dije', 'Cuando todos avisaron'],
  ['drama-express', 'Drama Express', 'Chisme rapido para scrollear'],
  ['quemazon-general', 'Quemazon General', 'De todo un poco'],
  ['confesionario', 'Confesionario', 'Lo que se queda entre nosotros'],
  ['pasillo-b', 'Pasillo B', 'Noticias que circulan sin horario'],
  ['cafecito-y-drama', 'Cafecito y Drama', 'Una taza, tres versiones'],
  ['la-fila', 'La Fila', 'Todo se sabe mientras esperas'],
  ['horario-roto', 'Horario Roto', 'Cruces imposibles entre clases'],
  ['notas-al-margen', 'Notas al Margen', 'Lo que aparece junto a los apuntes'],
  ['silla-reservada', 'Silla Reservada', 'Lugares con demasiada historia'],
  ['en-linea', 'En Linea', 'Drama de chats y videollamadas'],
  ['la-ultima-conexion', 'La Ultima Conexion', 'Horas que dicen demasiado'],
  ['reacciones', 'Reacciones', 'Un emoji puede iniciar todo'],
  ['favoritos', 'Favoritos', 'Mensajes guardados bajo sospecha'],
  ['el-grupo', 'El Grupo', 'La dinamica que nadie explica'],
  ['equipo-de-trabajo', 'Equipo de Trabajo', 'Colaboraciones con final dramatico'],
  ['presentacion-final', 'Presentacion Final', 'Diapositivas, nervios y secretos'],
  ['tareas-pendientes', 'Tareas Pendientes', 'Promesas que siguen sin entregarse'],
  ['calificaciones', 'Calificaciones', 'Numeros que provocan discusiones'],
  ['lista-de-asistencia', 'Lista de Asistencia', 'Quien estuvo y quien lo niega'],
  ['llegadas-tarde', 'Llegadas Tarde', 'Excusas con sello universitario'],
  ['campus-de-noche', 'Campus de Noche', 'Historias despues del ultimo timbre'],
  ['salida-de-clase', 'Salida de Clase', 'El momento donde empieza el chisme'],
  ['la-plaza', 'La Plaza', 'Encuentros que nadie planeo'],
  ['estacionamiento', 'Estacionamiento', 'Historias entre entradas y salidas'],
  ['camion-universitario', 'Camion Universitario', 'Trayectos llenos de teorias'],
  ['eventos', 'Eventos', 'Lo que paso cuando se apagaron las luces'],
  ['semana-cultural', 'Semana Cultural', 'Actividades y rumores de temporada'],
  ['torneo-interno', 'Torneo Interno', 'Competencia fuera de la cancha'],
  ['clubes', 'Clubes', 'Reuniones con agenda secreta'],
  ['voluntariado', 'Voluntariado', 'Buenas acciones y malos entendidos'],
  ['intercambio', 'Intercambio', 'Historias entre campus y fronteras'],
  ['primer-semestre', 'Primer Semestre', 'Aprendiendo a sobrevivir la U'],
  ['ultimo-semestre', 'Ultimo Semestre', 'Crisis antes de cerrar ciclo'],
  ['foraneos', 'Foraneos', 'Aventuras lejos de casa'],
  ['becarios', 'Becarios', 'Horas extra y rumores incluidos'],
  ['practicas', 'Practicas', 'La vida laboral antes de graduarse'],
  ['tesis', 'Tesis', 'Investigacion, cafe y decisiones dudosas'],
  ['graduacion', 'Graduacion', 'El drama de la ultima foto'],
  ['reencuentros', 'Reencuentros', 'Personas que regresan con historia'],
  ['nuevos-del-campus', 'Nuevos del Campus', 'Primeras impresiones anonimas'],
  ['veteranos', 'Veteranos', 'Tradiciones que nadie cuestiona'],
  ['manual-de-excusas', 'Manual de Excusas', 'Razones que merecen calificacion'],
  ['se-busca', 'Se Busca', 'Misterios pequenos de todos los dias'],
  ['alerta-de-chisme', 'Alerta de Chisme', 'Reporte urgente del pasillo'],
  ['radar-social', 'Radar Social', 'Detectando senales a distancia'],
  ['investigacion-abierta', 'Investigacion Abierta', 'Pistas sin conclusion oficial'],
  ['teorias', 'Teorias', 'Conjeturas con demasiada confianza'],
  ['versiones', 'Versiones', 'Cada quien cuenta una historia distinta'],
  ['sin-contexto', 'Sin Contexto', 'Una frase y demasiadas preguntas'],
  ['fuera-de-contexto', 'Fuera de Contexto', 'Momentos imposibles de explicar'],
  ['plot-twist', 'Plot Twist', 'Cuando la historia cambia de rumbo'],
  ['segunda-parte', 'Segunda Parte', 'El drama que no quiso terminar'],
  ['final-abierto', 'Final Abierto', 'Nadie sabe como acaba'],
  ['clasificados', 'Clasificados', 'Busquedas, avisos y coincidencias'],
  ['perdidos-y-encontrados', 'Perdidos y Encontrados', 'Objetos con historias propias'],
  ['intercambio-de-memes', 'Intercambio de Memes', 'Humor para sobrevivir la semana'],
  ['humor-de-campus', 'Humor de Campus', 'Situaciones que solo la U entiende'],
  ['lunes', 'Lunes', 'El drama empieza temprano'],
  ['viernes', 'Viernes', 'Todo puede pasar antes del fin'],
  ['fin-de-semestre', 'Fin de Semestre', 'Ultimas entregas y primeras excusas'],
  ['receso', 'Receso', 'Historias que siguen aunque no haya clases'],
  ['regreso-a-clases', 'Regreso a Clases', 'Nuevos rumores, mismos pasillos'],
  ['mala-influencia', 'Mala Influencia', 'Ideas que nadie debio seguir'],
  ['buenas-intenciones', 'Buenas Intenciones', 'Planes que tomaron otro rumbo'],
  ['casi-algo', 'Casi Algo', 'Relaciones sin nombre definido'],
  ['senales-mixtas', 'Senales Mixtas', 'Cuando nadie entiende el mensaje'],
  ['ghosting', 'Ghosting', 'Conversaciones que desaparecieron'],
  ['breadcrumbing', 'Breadcrumbing', 'Migajas digitales y mucha paciencia'],
  ['match-universitario', 'Match Universitario', 'Coincidencias con final incierto'],
  ['cita-en-campus', 'Cita en Campus', 'Romance entre clases y pendientes'],
  ['ex-del-grupo', 'Ex del Grupo', 'Seguir conviviendo no es facil'],
  ['amigos-con-drama', 'Amigos con Drama', 'La confianza tambien tiene plot twist'],
  ['familia-politica', 'Familia Politica', 'Cuando el chisme cruza grupos'],
  ['vecinos', 'Vecinos', 'Paredes delgadas y rumores grandes'],
  ['departamento', 'Departamento', 'Reglas de convivencia bajo prueba'],
  ['casa-de-estudiantes', 'Casa de Estudiantes', 'La novela despues de clase'],
  ['comida-compartida', 'Comida Compartida', 'Quien tomo lo que estaba marcado'],
  ['lavanderia', 'Lavanderia', 'Turnos, calcetines y acusaciones'],
  ['examen-sorpresa', 'Examen Sorpresa', 'El verdadero enemigo del semestre'],
  ['proyecto-en-equipo', 'Proyecto en Equipo', 'Cuando uno trabaja por todos'],
  ['exposiciones', 'Exposiciones', 'Nervios, diapositivas y miradas'],
  ['asesorias', 'Asesorias', 'Dudas academicas y algo mas'],
  ['horas-libres', 'Horas Libres', 'El tiempo donde nace el caos'],
  ['credencial', 'Credencial', 'El plastico que abre demasiadas puertas'],
  ['uniforme', 'Uniforme', 'Detalles que todos notan'],
  ['correo-institucional', 'Correo Institucional', 'Asuntos que debieron ser privados'],
  ['calendario', 'Calendario', 'Fechas que alguien olvido revisar'],
  ['notificaciones', 'Notificaciones', 'Avisos que llegan en el peor momento'],
  ['modo-silencio', 'Modo Silencio', 'Cuando nadie quiere responder'],
  ['visto-reciente', 'Visto Reciente', 'La evidencia mas incomoda'],
  ['borradores', 'Borradores', 'Mensajes que nunca salieron'],
  ['archivo-confidencial', 'Archivo Confidencial', 'Historias guardadas bajo llave'],
  ['caso-cerrado', 'Caso Cerrado', 'Misterios con conclusion dudosa'],
  ['caso-abierto', 'Caso Abierto', 'Todavia faltan demasiadas pistas'],
  ['jurado-del-pasillo', 'Jurado del Pasillo', 'Opiniones sin convocatoria oficial'],
  ['sentencia-social', 'Sentencia Social', 'El veredicto de la comunidad'],
  ['quemones-del-dia', 'Quemones del Dia', 'Resumen express de la jornada'],
  ['top-del-drama', 'Top del Drama', 'Las historias que todos comentan'],
  ['archivo-muerto', 'Archivo Muerto', 'Lo que regreso sin aviso'],
  ['resaca-emocional', 'Resaca Emocional', 'El dia despues del desastre'],
  ['no-pregunten', 'No Pregunten', 'La respuesta podria complicarlo todo'],
  ['ya-valio', 'Ya Valio', 'Cuando el plan se salio de control'],
  ['todo-normal', 'Todo Normal', 'Nada sospechoso, aparentemente'],
  ['solo-digo', 'Solo Digo', 'Observaciones que parecen inocentes'],
  ['no-me-quemes', 'No Me Quemes', 'Historias para leer con discrecion'],
  ['dejen-vivir', 'Dejen Vivir', 'Consejos que nadie solicito'],
  ['sin-juzgar', 'Sin Juzgar', 'Aunque todos ya tienen opinion'],
  ['la-comunidad', 'La Comunidad', 'Debates, apoyo y caos organizado'],
  ['entre-todos', 'Entre Todos', 'El feed que construimos juntos'],
];

const systemCategories = [
  ['general', 'General', 'Que esta pasando en la U'],
  ['quemones', 'Quemones', 'Historias y rumores del campus'],
  ['infieles', 'Infieles', 'Relaciones, dudas y mensajes cruzados'],
  ['confesiones', 'Confesiones', 'Lo que cuesta decir en persona'],
  ['stickers', 'Stickers', 'Reacciones para cada historia'],
];

const genericNames = ['Maria', 'Jose', 'Juan', 'Luis', 'Miguel', 'Carlos', 'Ana', 'Fernanda', 'Valeria', 'Mariana', 'Daniela', 'Diego', 'Jorge', 'Andrea', 'Paola', 'Ximena', 'Regina', 'Emiliano', 'Santiago', 'Mateo', 'Camila', 'Lupita', 'Chuy', 'Beto', 'Memo', 'Rocio', 'Dani', 'Sofi', 'Fer', 'Alex'];
const intros = ['En el grupo cuentan que', 'La historia empezo cuando', 'Todo iba normal hasta que', 'Ayer en la cafeteria alguien juro que', 'Dicen que despues de la clase', 'La version que circula es que', 'Nadie sabe bien como empezo, pero', 'A {name} le habian dicho que', 'El detalle que nadie esperaba fue que', 'Al parecer, todo el salon se entero cuando', 'La cosa se puso rara cuando', 'Segun quienes estaban cerca,', 'La noche iba tranquila hasta que', 'Nadie confirmo nada, pero al parecer', 'El chisme tomo otro rumbo cuando', 'A la manana siguiente todos comentaban que', 'La amiga de la mesa de al lado dice que', 'Entre cafe y cafe se supo que', 'Antes de que pregunten, dicen que', 'La parte que falta por aclarar es por que'];
const situations = ['le juro a {name} que ya habia bloqueado a su ex, pero seguia viendo sus historias', 'prometio exclusividad y aparecio abrazando a alguien de su supuesto grupo de estudio', 'pidio apuntes con cara triste y termino invitando cafe a medio salon', 'dijo que no iba a la fiesta y salio en una foto junto a quien juraba no conocer', 'borro comentarios justo cuando llego su pareja al patio', 'le dedico la misma cancion a {name} y a su ex con dos dias de diferencia', 'se hizo el confundido cuando le preguntaron por que tenia dos versiones de la historia', 'subio una indirecta y tres personas pensaron que era para ellas', 'juro que {name} era solo su amiga, aunque ya le habia presentado a su familia', 'cambio su estado sentimental despues de decir que necesitaba tiempo', 'se sento lejos en clase, pero reacciono a todas las historias', 'dejo en visto a {name} y a los dos minutos le escribio a su ex', 'organizo una salida casual con una lista de invitados demasiado calculada', 'llego con una historia distinta para cada persona y olvido cual le conto a {name}', 'repartio likes a todas las fotos de {name} y dijo que fue accidental', 'confundio el chat de la clase con el chat de la familia', 'prometio entregar el proyecto y desaparecio hasta la presentacion', 'subio una foto vieja con su ex despues de asegurar que ya no hablaban', 'se ofrecio a guardar un secreto y al rato ya lo sabia todo el equipo', 'cambio de mesa cada vez que entraba cierta persona', 'uso la misma frase romantica con {name} y con alguien del mismo salon', 'dijo que estaba ocupado y aparecio conectado toda la noche en el chat de su ex', 'invito a estudiar y termino haciendo un interrogatorio emocional', 'fingio no reconocer a {name}, aunque tenia sus fotos guardadas', 'reacciono con un corazon al mensaje equivocado y culpo al telefono', 'pidio una segunda oportunidad antes de explicar por que volvio con su ex', 'se sento junto a su ex y le dijo a {name} que fue pura casualidad', 'prometio no hacer drama y creo tres grupos nuevos', 'mando un audio de siete minutos para decir una sola cosa', 'aseguro que ya habia superado a {name} y reviso todas sus historias', 'puso una cancion triste y etiqueto a {name} en vez de a su ex', 'dejo un regalo sin firma con una nota escrita con su letra', 'se cambio de equipo justo despues de leer el chat', 'le pidio a su mejor amigo que cubriera la salida y el amigo conto la otra version', 'se fue de la fiesta diciendo que tenia sueño y termino en casa de su ex', 'cambio el nombre de contacto de su ex antes de prestarle el celular a {name}', 'invito a {name} a conocer a su familia y se le olvido que su ex tambien iria', 'lloro por la ruptura en la manana y por la noche subio fotos de reconciliacion', 'juro que el mensaje era para su hermano, aunque empezaba con mi amor', 'dijo que no tenia tiempo para una relacion y al dia siguiente anuncio que estaba saliendo con alguien'];

const facultySituations = [
  'en Derecho lo vieron salir del despacho de practicas con {name} despues de medianoche, aunque ambos dijeron que solo terminaban una tarea',
  'en Medicina alguien los vio besandose afuera de urgencias durante la guardia y al dia siguiente llegaron por separado',
  'en Arquitectura se quedaron solos en el taller hasta las tres de la manana y luego borraron la historia que habian subido',
  'en Ingenieria compartieron computadora toda la noche y terminaron saliendo por la puerta trasera, demasiado callados',
  'en Psicologia la pareja de {name} encontro mensajes que hablaban de una cena que supuestamente nunca ocurrio',
  'en Comunicacion aparecieron en el mismo video de una fiesta, muy juntos, aunque ambos dijeron que apenas se conocian',
  'en Contaduria alguien pago la cuenta de dos personas y dejo el ticket doblado dentro de una libreta',
  'en Administracion reservaron una sala para estudiar y salieron hasta que ya no quedaba nadie en el edificio',
  'en Enfermeria se pasaron toda la noche en la cafeteria del hospital y al amanecer uno de los dos cambio su foto de perfil',
  'en Diseño compartieron una chamarra durante la fiesta y luego negaron que hubieran llegado juntos',
  'en Turismo los vieron subirse al mismo taxi rumbo a la zona de bares, aunque cada quien habia dicho que se iba con su grupo',
  'en Gastronomia prepararon una cena para dos despues de decir que solo era una practica de clase',
  'en Ciencias Politicas se mandaron indirectas durante todo el debate y terminaron hablando aparte en el estacionamiento',
  'en Educacion alguien los encontro abrazados en las gradas despues del evento de la facultad',
  'en Veterinaria llego una foto de {name} a las cuatro de la manana desde una casa donde supuestamente nadie estaba',
  'en Economia se intercambiaron el celular durante la fiesta y despues uno de los dos pidio que borraran el chat',
  'en Artes los vieron bailando demasiado cerca y saliendo juntos justo antes de que llegara la pareja de uno de ellos',
  'en Odontologia se fueron de la reunion diciendo que buscarian hielo y regresaron una hora despues con la misma explicacion',
  'en Quimica una persona del laboratorio aseguro que {name} recibio flores de alguien que no era su pareja',
  'en Biologia terminaron una practica de noche y solo uno de los dos aparecio en la foto de salida',
  'en Matematicas el supuesto equipo de estudio se redujo a dos personas y una playlist romantica',
  'en Fisica se quedaron cerrando el salon y alguien escucho una discusion sobre mensajes borrados',
  'en Agronomia los vieron sentados juntos en la camioneta de practicas despues de la posada',
  'en Relaciones Internacionales {name} dijo que viajaba con el grupo, pero las fotos solo mostraban a dos personas',
  'en Trabajo Social se enteraron de la reconciliacion porque llegaron tomados de la mano a la reunion',
  'en Filosofia pasaron de discutir sobre el amor a besarse afuera de la biblioteca, segun quien los vio',
  'en Historia alguien encontro una carta en el casillero equivocado y la firma no dejaba muchas dudas',
  'en Lenguas se escucho a {name} practicar una declaracion romantica con alguien que no era su pareja',
  'en Geologia salieron del laboratorio juntos cerca de la medianoche y ambos dejaron el celular en silencio',
  'en Sistemas aparecio una sesion abierta con una conversacion que explicaba por que dos personas ya no se hablaban',
];
const endings = ['Y todavia dicen que solo son amigos.', 'El grupo se quedo en silencio, pero todos entendieron.', 'La amiga que dijo que no se metia fue la primera en mandar la captura.', 'A la manana siguiente llegaron juntos y con la misma excusa.', 'La verdad aparecio justo cuando ya habian borrado el chat.', 'Nadie sabe si volvieron, pero ya apartaron mesa para dos.', 'La version cambio despues de que aparecio el recibo.', 'Su ex ya estaba en la puerta cuando termino de negarlo.', 'Todo empezo por un te marco al rato.', 'El secreto duro hasta que alguien pregunto por el segundo juego de llaves.', 'Desde ese dia, nadie vuelve a creer en las coincidencias del pasillo.', 'Una disculpa no borra el mensaje, pero por algo se empieza.', 'El cafe se enfrio mientras todos esperaban que alguien dijera la verdad.', 'Justo cuando parecia arreglado, llego otro audio.', 'La historia no termino: solo cambiaron el nombre del grupo.', 'Al final, la unica persona que no sabia era quien tenia que saberlo.', 'El salon entero conoce la historia, menos quienes salen en ella.', 'Prometieron no volver a hablarse y se fueron en el mismo carro.', 'La verdad salio durante la comida del domingo.', 'A {name} le toca decidir si guarda el secreto o cuenta la segunda parte.'];
const commentBits = ['yo pense que era la unica persona que habia notado eso', 'A {name} le paso algo parecido el semestre pasado', 'no se como termina esto pero ya quiero la actualizacion', 'me suena a que alguien entendio mal el mensaje', 'lo raro es que al dia siguiente llegaron juntos como si nada', 'yo preguntaria directamente, tanto misterio cansa', 'esto empezo por una cosa chiquita y ya va por todo el grupo', 'en mi salon paso igual y solo faltaba hablarlo', 'no quiero meter cizaña pero esa respuesta estuvo rara', 'capaz solo coincidio el horario, tampoco hay que armar novela', 'alguien que estaba ahi cuente como empezo todo', 'me da risa que todos sepan algo distinto', 'yo estaba haciendo fila por cafe y escuche tres versiones', 'siempre dicen que no pasa nada y luego aparecen juntos otra vez', 'A {name} le deben una disculpa y minimo un cafe', 'esto se arreglaba con un mensaje de dos lineas', 'yo no tomaria partido sin escuchar a las dos personas', 'la amiga que sabe todo pero dice que no sabe nada', 'que incomodo cuando toca sentarse juntos en la siguiente clase', 'a veces una reaccion no significa absolutamente nada', 'pues que lo hablen antes de la siguiente presentacion', 'no es por defender a nadie, pero falta contexto', 'la proxima vez hagan el trabajo en persona y sin veinte chats', 'mi consejo es dormir y contestar manana con la cabeza fria', 'con razon hoy todo el mundo estaba mirando el celular'];
const replyBits = ['eso mismo, pero falta escuchar la otra version', 'yo tambien pense eso cuando lei la primera parte', 'espera, yo entendi que fue el martes, no el jueves', 'A {name} tambien le contaron algo distinto', 'puede ser, aunque a mi me dijeron que ya lo hablaron', 'yo no estaba ahi pero si vi que salieron juntos', 'no le pongan tanta malicia, capaz fue un malentendido', 'esa es justo la parte que nadie sabe explicar', 'me mandaron otra version y ahora tengo mas dudas', 'si van a aclararlo, que sea sin indirectas', 'yo vi el mensaje y estaba escrito muy diferente', 'tambien puede ser que simplemente se le olvidara responder', 'esa parte si me la perdi, alguien me pone al dia?', 'A {name} le paso por confiar en el chat equivocado', 'la cronologia no cuadra, pero nadie sabe la hora exacta', 'vine por una respuesta y sali con tres preguntas nuevas', 'no creo que haya sido con mala intencion', 'esa es una buena teoria, pero sigue siendo teoria', 'si alguien tiene contexto que lo cuente sin nombres completos', 'igual mejor preguntar antes de asumir cosas', 'me rei, pero estaria bueno aclararlo en privado', 'bueno, me retiro hasta que alguien confirme algo'];

/* Bloque antiguo conservado fuera de ejecucion.
    'En el pasillo cuentan que',
    'La historia empezo cuando',
    'Todo iba normal hasta que',
    'Ayer en la cafeteria alguien juro que',
    'Dicen que despues de la clase',
    'La version que circula por el grupo es que',
    'Nadie sabe bien como empezo, pero',
    'A {name} le habian prometido que',
    'El detalle que nadie esperaba fue que',
    'Al parecer, todo el salon se entero cuando',
  'Contenido de ejemplo: alguien conto que',
    'La cosa se puso seria cuando',
  'Para probar el feed lleno, supuestamente',
    'Segun cuentan quienes estaban cerca,',
    'La noche iba tranquila hasta que',
  'Reporte de pasillo, completamente ficticio: resulta que',
  'La version demo cuenta que',
  'Nadie confirmo nada, pero al parecer',
  'Abriendo expediente imaginario: alguien',
    'El chisme tomo otro rumbo cuando',
    'A la manana siguiente todos comentaban que',
    'La amiga que estaba en la mesa de al lado dice que',
  'Entre cafe y cafe se supo que',
  'La teoria de hoy dice que',
  'Mensaje sin remitente: aparentemente',
    'La parte que falta por aclarar es por que',
  'El algoritmo del drama detecto que',
  'Llegan nuevos detalles ficticios: resulta que',
  'Con cero pruebas y mucha imaginacion,',
  'La mesa de al lado asegura que',
    'le juro a {name} que ya habia bloqueado a su ex, pero seguia viendo sus historias desde otra cuenta',
    'prometio exclusividad y luego aparecio en historias abrazando a su supuesto "grupo de estudio"',
  'Caso abierto para fines de prueba:',
    'dijo que no iba al after y termino saliendo en las fotos junto a la persona que juraba no conocer',
];
    'le dedico la misma cancion a {name} y a su ex con apenas dos dias de diferencia',
    'se hizo el confundido cuando le preguntaron por que tenia dos versiones de la misma historia',
  'le mandaban buenos dias a tres personas distintas antes de entrar a clase',
    'juro que {name} era solo su amiga, aunque ya le habia presentado a toda su familia',
    'cambio su estado sentimental cinco minutos despues de decir que necesitaba tiempo',
  'dijo que no iba al after y salio etiquetado en cuatro fotos',
    'llego tarde al parcial despues de pasar la manana discutiendo por quien habia visto a quien',
  'tenia dos playlists romanticas con nombres sospechosamente parecidos',
    'dejo en visto a {name} y a los dos minutos le mando un "te extraño" a su ex',
  'subio una indirecta y tres personas pensaron que era para ellas',
    'llego con una historia distinta para cada persona y olvido cual le habia contado a {name}',
    'repartio likes a todas las fotos de {name} y luego dijo que el celular se desbloqueo solo',
  'se sento lejos en clase, pero reacciono a todas las historias',
  'llego tarde al parcial con una excusa que parecia guion de novela',
    'subio una foto vieja con su ex justo despues de asegurarle a {name} que ya no hablaban',
    'se ofrecio a guardar un secreto y al rato ya lo sabia hasta el equipo de futbol',
  'organizo una salida "casual" con lista de invitados demasiado calculada',
  'llego con una historia distinta dependiendo de quien preguntara',
  'repartio likes estrategicos y luego dijo que fue accidental',
    'uso la misma frase romantica con {name} y con alguien mas del mismo salon',
    'dijo que estaba ocupado y aparecio conectado toda la noche en el chat de su ex',
  'subio una foto vieja para provocar una reaccion nueva',
  'se ofrecio a guardar un secreto y lo conto con demasiados detalles',
  'cambio de mesa cada vez que entraba cierta persona',
    'le puso nombre secreto a una relacion que ya conocian hasta sus primos',
    'fingio no reconocer a {name}, aunque tenia sus fotos guardadas desde el semestre pasado',
  'uso la misma frase romantica en tres conversaciones',
    'reacciono con un corazon al mensaje equivocado y luego dijo que era una prueba del telefono',
  'invito a estudiar y termino haciendo interrogatorio emocional',
  'pidio una opinion y se enojo con todas las respuestas',
  'se despidio del grupo y regreso con una captura nueva',
  'le puso nombre secreto a una relacion que nadie entendia',
    'pidio una segunda oportunidad antes de explicar por que habia vuelto con su ex',
  'llevo cafe para una persona y termino repartiendolo entre cinco',
    'se sento junto a su ex y le dijo a {name} que fue pura casualidad',
  'dijo que todo estaba bien con una cara que decia lo contrario',
    'llego a clase con flores y dijo que eran para su mama, pero nadie vio que se las llevara',
  'se conecto justo cuando la conversacion se puso interesante',
  'organizo una encuesta para resolver algo que ya estaba decidido',
  'pidio segunda oportunidad antes de explicar la primera',
    'aseguro que ya habia superado a {name} y reviso cada una de sus historias',
  'se sento junto a su ex y llamo a eso madurez emocional',
  'prometio no hacer drama y creo tres grupos nuevos',
  'llego a clase con flores y dijo que eran para un experimento',
    'dijo que era coincidencia por quinta vez en la semana que se encontro con {name}',
  'mando un audio de siete minutos para decir una sola cosa',
  'dejo su sesion abierta en la computadora equivocada',
  'aseguro que no le importaba y reviso cada reaccion',
  'pidio que nadie tomara fotos y luego subio un album completo',
    'puso una cancion triste y etiqueto a {name} en vez de a su ex',
  'ofrecio una explicacion que genero cuatro preguntas nuevas',
  'dijo que era coincidencia por quinta vez en la semana',
    'dejo un regalo sin firma con una nota que tenia su letra por todas partes',
  'hizo una lista de razones y olvido la razon principal',
  'llego temprano solo para elegir el asiento mas sospechoso',
  'convoco una reunion urgente por un mensaje de dos palabras',
  'puso una cancion triste y etiqueto a la persona equivocada',
  'juro que no habia visto el mensaje que tenia abierto',
  'pidio consejo y termino dando una conferencia',
    'le dijo a {name} que era la unica persona en su vida y al rato subio una foto abrazando a su ex',
    'juro que no habia vuelto con su ex, pero su familia ya le habia guardado lugar en la mesa',
    'le pidio a su mejor amigo que cubriera la salida y el amigo termino llegando con la otra version',
    'se fue de la fiesta diciendo que tenia sueño y termino amaneciendo en casa de su ex',
    'aseguro que el anillo era de su abuela, aunque {name} lo habia visto en una caja de regalo',
    'cambio el nombre de contacto de su ex justo antes de prestarle el celular a {name}',
    'dijo que iba a visitar a su tia y regreso con el mismo ramo que habia presumido otra persona',
    'invito a {name} a conocer a su familia y se le olvido que su ex tambien iba a estar ahi',
    'le conto a cada quien una version diferente de por que cancelaron la boda',
    'lloro por la ruptura en la manana y por la noche ya estaba subiendo fotos de reconciliacion',
    'juro que el mensaje era para su hermano, aunque empezaba con "mi amor"',
    'le dijo a {name} que no tenia tiempo para una relacion y al dia siguiente anuncio compromiso',
  'dejo un regalo anonimo con una pista demasiado obvia',
  'se cambio de equipo justo despues de leer el chat',
  'publico una despedida y volvio a publicar en diez minutos',
    'Y todavia dicen que solo son amigos.',
    'La reconciliacion duro menos que el trayecto de regreso a casa.',
    'Desde entonces, nadie vuelve a prestar su celular desbloqueado.',
    'La familia ya tomo partido y ni siquiera escucho la otra version.',
    'A {name} le toca explicar por que tenia las llaves del departamento.',
    'El grupo se quedo en silencio, pero las miradas dijeron todo.',
    'Al final, quien menos hablaba era quien tenia todos los mensajes.',
    'La amiga que dijo "yo no me meto" fue la primera en mandar la captura.',
    'A la manana siguiente llegaron juntos y con la misma excusa.',
    'La verdad aparecio justo cuando ya habian borrado el chat.',
    'Nadie sabe si volvieron, pero ya apartaron mesa para dos.',
    'El ramo llego a la casa correcta, solo que con tres dias de retraso.',
    'La version oficial cambio despues de que aparecio el recibo.',
    'Su ex ya estaba en la puerta cuando termino de negarlo.',
    'Y pensar que todo empezo por un "te marco al rato".',
    'A {name} le dejaron el visto; a la familia, la invitacion.',
    'La proxima reunion familiar va a estar buenisima.',
    'El secreto duro hasta que alguien pregunto por el segundo juego de llaves.',
    'La boda sigue en pie, pero ahora hay dos versiones de la lista de invitados.',
    'Desde ese dia, nadie vuelve a creer en las coincidencias del pasillo.',
    'Una disculpa no borra el mensaje, pero por algo se empieza.',
    'El cafe se enfrio mientras todos esperaban que alguien dijera la verdad.',
    'Y justo cuando parecia que ya se habian arreglado, llego otro audio.',
    'La historia no termino: solo cambiaron el nombre del grupo.',
    'Al final, la unica persona que no sabia era quien tenia que saberlo.',
    'La reconciliacion fue publica; la explicacion, todavia pendiente.',
    'Nadie vio venir que el testigo fuera el chofer del camion.',
    'A {name} le toca escoger entre guardar el secreto o contar la segunda parte.',
    'El salon entero ya conoce la historia, menos quienes salen en ella.',
    'Prometieron no volver a hablarse y se fueron en el mismo carro.',
    'La verdad salio en la comida del domingo, frente a toda la familia.',
  ];

  const genericNames = [
    'Dani', 'Alex', 'Sofi', 'Fer', 'Vale', 'Sam', 'Nico', 'Andy', 'Maria', 'Jose',
    'Juan', 'Luis', 'Miguel', 'Carlos', 'Ana', 'Fernanda', 'Valeria', 'Mariana',
    'Daniela', 'Diego', 'Jorge', 'Andrea', 'Paola', 'Ximena', 'Regina', 'Emiliano',
    'Santiago', 'Mateo', 'Camila', 'Lupita', 'Chuy', 'Beto', 'Toño', 'Memo', 'Rocio',
  ];
  'Caso cerrado hasta que alguien encuentre otro detalle.',
  'La segunda parte ya se escribio sola.',
  'Esto fue un servicio publico para la curiosidad.',
  'La categoria sobrevivio otro dia de caos.',
  'La version oficial sigue en construccion.',
];

const genericNames = ['Dani', 'Alex', 'Sofi', 'Fer', 'Vale', 'Sam', 'Nico', 'Andy'];

const commentBits = [
  'yo pense que era la unica persona que habia notado eso',
  'A {name} le paso algo parecido en el equipo del semestre pasado',
  'no se como termina esto pero ya quiero la actualizacion',
  'me suena a que alguien entendio mal el mensaje y de ahi se hizo grande',
  'lo mas raro es que al dia siguiente llegaron juntos como si nada',
  'yo preguntaria directamente, tanto misterio cansa',
  'esto empezo por una cosa chiquita y ya va por el grupo entero',
  'en mi salon paso igual y al final solo faltaba hablarlo',
  'A {name} siempre le toca estar en medio de estas historias',
  'no quiero meter cizaña pero esa respuesta si estuvo rara',
  'capaz solo coincidio el horario, tampoco hay que armar novela',
  'alguien que estaba ahi cuente como empezo todo',
  'me da risa que todos sepan algo distinto',
  'yo estaba haciendo fila por cafe y escuche tres versiones',
  'siempre dicen que no pasa nada y luego aparecen juntos otra vez',
  'la parte del trabajo en equipo me representa demasiado',
  'A {name} le deben una disculpa y minimo un cafe',
  'esperen, quien invito a quien primero?',
  'esto se arreglaba con un mensaje de dos lineas',
  'yo no tomaria partido sin escuchar a las dos personas',
  'la amiga que sabe todo pero dice que no sabe nada',
  'me paso algo asi y si, el chat se vuelve un telefono descompuesto',
  'que incomodo cuando toca sentarse juntos en la siguiente clase',
  'yo solo venia a ver si ya publicaron las notas',
  'A {name} lo vi saliendo de la biblioteca con cara de no haber dormido',
  'el verdadero problema es que nadie lee bien el calendario',
  'a veces una reaccion no significa absolutamente nada, gente',
  'la version que me contaron tenia menos personajes que esta',
  'pues que lo hablen antes de que llegue a la presentacion final',
  'esto me recordo por que nunca presto mis apuntes originales',
  'no se quien tiene razon pero alguien tiene que devolver ese cargador',
  'A {name} le quedo debiendo desde la semana pasada, no olviden eso',
  'cinco minutos tarde y ya habia cambiado toda la historia',
  'de verdad nadie sabe quien creo el grupo nuevo?',
  'mejor preguntenle en privado, aqui ya hay demasiadas versiones',
  'el silencio despues de ese mensaje fue larguisimo',
  'no es por defender a nadie, pero falta contexto',
  'la proxima vez hagan el trabajo en persona y sin veinte chats',
  'jajaja lo peor es que esto si pasa cada semestre',
  'yo le creo a quien llevo snacks para todos',
  'A {name} le toca contar la otra mitad ahora',
  'ya quiero saber si al final si entregaron el proyecto',
  'esto no era lo que esperaba encontrar mientras esperaba el bus',
  'nadie habla de quien se llevo la ultima silla',
  'se siente que alguien va a mandar un audio larguisimo despues de esto',
  'mi consejo es dormir y contestar mañana con la cabeza fria',
  'la proxima reunion pudo ser un correo, pero esta historia no',
  'con razon hoy todo el mundo estaba mirando el celular',
  'A {name} le toca escoger equipo con cuidado la proxima vez',
  'ojala se arregle, ya bastante estres hay con los parciales',
];

const replyBits = [
  'eso mismo, pero creo que falta escuchar la otra version',
  'jajaja yo tambien pense eso cuando lei la primera parte',
  'espera, yo entendi que fue el martes, no el jueves',
  'A {name} tambien le contaron algo distinto',
  'puede ser, aunque a mi me dijeron que ya lo hablaron',
  'confirmo que el grupo estuvo raro toda la tarde',
  'yo no estaba ahi pero si vi que salieron juntos',
  'no le pongan tanta malicia, capaz fue un malentendido',
  'esa es justo la parte que nadie sabe explicar',
  'me acaban de mandar otra version y ahora tengo mas dudas',
  'si van a aclararlo, que sea sin mandar indirectas',
  'A {name} sabe como empezo, pero no quiere meterse',
  'yo vi el mensaje y estaba escrito muy diferente',
  'jajaja en mi grupo paso lo mismo con una exposicion',
  'tambien puede ser que simplemente se le olvidara responder',
  'no inventen mas, mejor que lo cuenten quienes estaban ahi',
  'esa parte si me la perdi, alguien me pone al dia?',
  'al final todos terminaron compartiendo la misma mesa',
  'mi fuente fue la persona que estaba buscando sus llaves',
  'A {name} le paso por confiar en el chat equivocado',
  'yo digo que lo resuelvan antes de que toque hacer otro trabajo juntos',
  'la cronologia no cuadra, pero tampoco sabemos la hora exacta',
  'vine por una respuesta y sali con tres preguntas nuevas',
  'no creo que haya sido con mala intencion, la verdad',
  'jajaja ya aparecio alguien que si estaba en la cafeteria',
  'esa es una buena teoria, pero sigue siendo teoria',
  'les juro que todo esto empezo por una silla guardada',
  'si alguien tiene contexto que lo cuente sin nombres completos',
  'A {name} seguro va a leer esto y hacerse el sorprendido',
  'por favor digan que al menos si entregaron el proyecto',
  'yo tambien me iria temprano si tuviera parcial a primera hora',
  'bueno, ahora necesito saber quien llevo el cafe',
  'la respuesta mas sensata de todo este hilo',
  'eso explica por que cambiaron el plan a ultima hora',
  'igual mejor preguntar antes de asumir cosas',
  'me rei, pero si estaria bueno aclararlo en privado',
  'A {name} le va a tocar leer todo esto mañana',
  'el verdadero plot twist es que si llegaron a tiempo',
  'ya entendí, el problema era el grupo de trabajo desde el inicio',
  'bueno, me retiro hasta que alguien confirme algo',
];

*/

const reactionEmojis = ['❤️', '😂', '🤯', '🫶', '🙃', '🫪'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days, hours = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  return date;
}

function authorId(index) {
  return `demo-anon-${String(index + 1).padStart(2, '0')}-${crypto
    .createHash('sha1')
    .update(`quemados-demo-author-${index}`)
    .digest('hex')
    .slice(0, 8)}`;
}

function ownerToken(index) {
  return crypto
    .createHash('md5')
    .update(`quemados-demo-owner-${index}`)
    .digest('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
}

function makePostContent(i) {
  const situationPool = randomInt(1, 100) <= 48 ? facultySituations : situations;
  return `${pick(intros).replaceAll('{name}', pick(genericNames))} ${pick(situationPool).replaceAll('{name}', pick(genericNames))}. ${pick(endings).replaceAll('{name}', pick(genericNames))}`;
}

function makeCommentContent(i) {
  return pick(commentBits).replaceAll('{name}', pick(genericNames));
}

function makeReplyContent(i) {
  return pick(replyBits).replaceAll('{name}', pick(genericNames));
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function weightedEngagement(max) {
  const roll = randomInt(1, 100);
  if (roll <= 8) return randomInt(Math.floor(max * 0.65), max);
  if (roll <= 25) return randomInt(Math.floor(max * 0.22), Math.floor(max * 0.62));
  if (roll <= 58) return randomInt(Math.floor(max * 0.05), Math.floor(max * 0.2));
  if (roll <= 82) return randomInt(1, Math.max(2, Math.floor(max * 0.04)));
  return 0;
}

function reactionPlan(maxTotal) {
  const total = weightedEngagement(maxTotal);
  if (total <= 0) return [];

  const emojiCountRoll = randomInt(1, 100);
  const emojiCount = emojiCountRoll <= 40 ? 1 : emojiCountRoll <= 72 ? 2 : emojiCountRoll <= 92 ? 3 : randomInt(4, reactionEmojis.length);
  const selected = shuffle(reactionEmojis).slice(0, emojiCount);
  const plan = [];
  let remaining = total;

  for (let i = 0; i < selected.length; i += 1) {
    const isLast = i === selected.length - 1;
    const count = isLast ? remaining : randomInt(1, Math.max(1, Math.floor(remaining * (i === 0 ? 0.8 : 0.55))));
    if (count > 0) plan.push([selected[i], count]);
    remaining -= count;
    if (remaining <= 0) break;
  }
  return plan;
}

async function ensureSchema(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      slug VARCHAR(40) PRIMARY KEY,
      name VARCHAR(40) NOT NULL,
      description VARCHAR(120) NOT NULL DEFAULT '',
      creator_anon_id TEXT,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_idx ON categories (LOWER(name))');
  await client.query(`
    ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS last_bumped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS owner_token UUID,
        ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS trust_score INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS trust_unlocked BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await client.query(`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS owner_token UUID,
      ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS trust_score INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS trust_unlocked BOOLEAN NOT NULL DEFAULT FALSE
  `);
}

function trustProfile() {
  const roll = randomInt(1, 100);
  const trustScore = roll <= 8
    ? randomInt(-8, -1)
    : roll <= 28
      ? randomInt(0, 9)
      : roll <= 88
        ? randomInt(10, 34)
        : randomInt(35, 75);
  return { trustScore, trustUnlocked: trustScore >= 10 };
}

async function backfillDemoTrustProfiles(client) {
  let updated = 0;
  for (const table of ['posts', 'comments']) {
    const rows = await client.query(
      `SELECT id FROM ${table}
       WHERE anon_id LIKE 'demo-anon-%' AND trust_score = 0 AND trust_unlocked = FALSE`
    );
    for (const row of rows.rows) {
      const { trustScore, trustUnlocked } = trustProfile();
      await client.query(
        `UPDATE ${table} SET trust_score = $1, trust_unlocked = $2 WHERE id = $3`,
        [trustScore, trustUnlocked, row.id]
      );
      updated += 1;
    }
  }
  return updated;
}

async function seedCategories(client) {
  const all = [...systemCategories.map((row) => [...row, true]), ...extraCategories.map((row) => [...row, false])];
  for (const [slug, name, description, isSystem] of all) {
    await client.query(
      `INSERT INTO categories (slug, name, description, creator_anon_id, is_system)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = EXCLUDED.is_system`,
      [slug, name, description, isSystem ? null : pick(authors), isSystem]
    );
  }
  return all.map(([slug]) => slug);
}

async function seedPost(client, i, categories) {
  const createdAt = daysAgo(randomInt(0, 18), randomInt(0, 23));
  const upvotes = randomInt(0, 180);
  const downvotes = randomInt(0, 45);
  const { trustScore, trustUnlocked } = trustProfile();
  const bumpedAt = new Date(createdAt.getTime() + randomInt(0, 72) * 60 * 60 * 1000);
  const category = pick(categories.filter((categorySlug) => categorySlug !== 'stickers'));
  const result = await client.query(
    `INSERT INTO posts (
       anon_id, content, category, upvotes, downvotes, owner_token, created_at, last_bumped_at,
       trust_score, trust_unlocked
     )
     VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10)
     RETURNING id`,
    [
      pick(authors),
      makePostContent(i),
      category,
      upvotes,
      downvotes,
      ownerToken(i),
      createdAt,
      bumpedAt > new Date() ? new Date() : bumpedAt,
      trustScore,
      trustUnlocked,
    ]
  );
  return result.rows[0].id;
}

async function seedComments(client, postIds) {
  const commentIds = [];
  for (let i = 0; i < COMMENT_COUNT; i += 1) {
    const postId = pick(postIds);
    const createdAt = daysAgo(randomInt(0, 14), randomInt(0, 23));
    const { trustScore, trustUnlocked } = trustProfile();
    const inserted = await client.query(
      `INSERT INTO comments (
         post_id, anon_id, content, upvotes, downvotes, owner_token, created_at,
         trust_score, trust_unlocked
       )
       VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9)
       RETURNING id`,
      [
        postId,
        pick(authors),
        makeCommentContent(i),
        randomInt(0, 70),
        randomInt(0, 18),
        ownerToken(1000 + i),
        createdAt,
        trustScore,
        trustUnlocked,
      ]
    );
    commentIds.push(inserted.rows[0]?.id);
  }
  return commentIds.filter(Boolean);
}

async function seedReplies(client, requestedCount) {
  if (requestedCount <= 0) return [];

  const seedParents = await client.query(
    `SELECT id, post_id, created_at
     FROM comments
     WHERE is_hidden = false AND is_deleted = false
     ORDER BY created_at DESC
     LIMIT 1500`
  );
  if (!seedParents.rows.length) return [];

  const commentPool = [...seedParents.rows];
  const replyIds = [];
  for (let i = 0; i < requestedCount; i += 1) {
    const parent = pick(commentPool);
    const parentDate = new Date(parent.created_at);
    const createdAt = new Date(parentDate.getTime() + randomInt(3, 10080) * 60 * 1000);
    const { trustScore, trustUnlocked } = trustProfile();
    const inserted = await client.query(
      `INSERT INTO comments (
         post_id, parent_id, anon_id, content, upvotes, downvotes, owner_token, created_at,
         trust_score, trust_unlocked
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8, $9, $10)
       RETURNING id, post_id, created_at`,
      [
        parent.post_id,
        parent.id,
        pick(authors),
        makeReplyContent(i),
        weightedEngagement(260),
        weightedEngagement(36),
        ownerToken(5000 + i),
        createdAt > new Date() ? new Date() : createdAt,
        trustScore,
        trustUnlocked,
      ]
    );
    const reply = inserted.rows[0];
    replyIds.push(reply.id);
    if (randomInt(1, 100) <= 42) commentPool.push(reply);
  }
  return replyIds;
}

async function addReactionPlan(client, table, idColumn, id, prefix, maxTotal) {
  const plan = reactionPlan(maxTotal);
  const rows = [];
  for (const [emoji, count] of plan) {
    for (let i = 0; i < count; i += 1) {
      rows.push([id, `${prefix}-${id.slice(0, 8)}-${emoji}-${i}`, emoji]);
    }
  }
  for (let start = 0; start < rows.length; start += 500) {
    const chunk = rows.slice(start, start + 500);
    const params = [];
    const values = chunk.map((row, i) => {
      params.push(...row);
      const base = i * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    });
    await client.query(
      `INSERT INTO ${table} (${idColumn}, voter_token, emoji)
       VALUES ${values.join(', ')}
       ON CONFLICT (${idColumn}, voter_token) DO UPDATE SET emoji = EXCLUDED.emoji`,
      params
    );
  }
  return rows.length;
}

async function seedReactionsAndVotes(client, postIds) {
  const voterTokens = Array.from({ length: AUTHOR_COUNT * 2 }, (_, i) => `demo-voter-${i + 1}`);
  for (const postId of postIds) {
    await addReactionPlan(client, 'post_reactions', 'post_id', postId, 'demo-post-reaction', 340);

    const sampleSize = randomInt(5, 20);
    for (let i = 0; i < sampleSize; i += 1) {
      const token = `${pick(voterTokens)}-${postId.slice(0, 8)}-${i}`;
      await client.query(
        `INSERT INTO votes (post_id, voter_token, vote_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (post_id, voter_token) DO NOTHING`,
        [postId, token, randomInt(1, 100) > 24 ? 'up' : 'down']
      );
      if (randomInt(1, 100) > 35) {
        await client.query(
        `INSERT INTO post_reactions (post_id, voter_token, emoji)
           VALUES ($1, $2, $3)
           ON CONFLICT (post_id, voter_token) DO UPDATE SET emoji = EXCLUDED.emoji`,
        [postId, token, pick(reactionEmojis)]
        );
      }
    }
  }
}

async function backfillExistingReactions(client) {
  if (!BACKFILL_REACTIONS) return { posts: 0, comments: 0 };

  const posts = await client.query(
    `SELECT id FROM posts WHERE is_hidden = false ORDER BY created_at DESC`
  );
  const comments = await client.query(
    `SELECT id FROM comments WHERE is_hidden = false AND is_deleted = false ORDER BY created_at DESC`
  );

  for (const row of posts.rows) {
    await addReactionPlan(client, 'post_reactions', 'post_id', row.id, 'demo-backfill-post', 320);
    const upvotes = weightedEngagement(260);
    const downvotes = weightedEngagement(55);
    await client.query(
      `UPDATE posts
       SET upvotes = GREATEST(upvotes, $2), downvotes = GREATEST(downvotes, $3)
       WHERE id = $1`,
      [row.id, upvotes, downvotes]
    );
  }

  for (const row of comments.rows) {
    await addReactionPlan(client, 'comment_reactions', 'comment_id', row.id, 'demo-backfill-comment', 260);
    const upvotes = weightedEngagement(240);
    const downvotes = weightedEngagement(42);
    await client.query(
      `UPDATE comments
       SET upvotes = GREATEST(upvotes, $2), downvotes = GREATEST(downvotes, $3)
       WHERE id = $1`,
      [row.id, upvotes, downvotes]
    );
  }

  return { posts: posts.rowCount, comments: comments.rowCount };
}

async function cleanUnsupportedReactions(client) {
  if (!CLEAN_UNSUPPORTED_REACTIONS) return { posts: 0, comments: 0 };
  if (RESET_DEMO_REACTIONS) {
    await client.query("DELETE FROM post_reactions WHERE voter_token LIKE 'demo-%'");
    await client.query("DELETE FROM comment_reactions WHERE voter_token LIKE 'demo-%'");
  }
  const postResult = await client.query(
    'DELETE FROM post_reactions WHERE NOT (emoji = ANY($1::text[]))',
    [reactionEmojis]
  );
  const commentResult = await client.query(
    'DELETE FROM comment_reactions WHERE NOT (emoji = ANY($1::text[]))',
    [reactionEmojis]
  );
  return { posts: postResult.rowCount, comments: commentResult.rowCount };
}

async function seedCommentReactions(client, commentIds) {
  for (const commentId of commentIds) {
    await addReactionPlan(client, 'comment_reactions', 'comment_id', commentId, 'demo-comment-reaction', 280);
  }
}

async function seedPolls(client, postIds) {
  const pollPosts = postIds.filter((_, i) => i % 9 === 0);
  for (const postId of pollPosts) {
    const poll = await client.query(
      `INSERT INTO post_polls (post_id, question)
       VALUES ($1, $2)
       ON CONFLICT (post_id) DO UPDATE SET question = EXCLUDED.question
       RETURNING id`,
      [postId, pick(['Que tan quemado quedo?', 'Le creemos?', 'Quien trae la mejor teoria?', 'Esto sigue o se apaga?'])]
    );
    const pollId = poll.rows[0].id;
    const options = ['Si, confirmado', 'Falta contexto', 'Puro humo', 'Necesito parte 2'];
    for (let i = 0; i < options.length; i += 1) {
      const option = await client.query(
        `INSERT INTO post_poll_options (poll_id, label, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (poll_id, position) DO UPDATE SET label = EXCLUDED.label
         RETURNING id`,
        [pollId, options[i], i]
      );
      const votes = randomInt(3, 22);
      for (let vote = 0; vote < votes; vote += 1) {
        await client.query(
          `INSERT INTO post_poll_votes (poll_id, option_id, anon_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (poll_id, anon_id) DO NOTHING`,
          [pollId, option.rows[0].id, `${pick(authors)}-poll-${i}-${vote}`]
        );
      }
    }
  }
}

const authors = Array.from({ length: AUTHOR_COUNT }, (_, i) => authorId(i));

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchema(client);
    const backfilledTrustProfiles = await backfillDemoTrustProfiles(client);
    const categories = await seedCategories(client);
    const postIds = [];
    for (let i = 0; i < POST_COUNT; i += 1) {
      postIds.push(await seedPost(client, i, categories));
    }
    const commentIds = postIds.length ? await seedComments(client, postIds) : [];
    const replyIds = await seedReplies(client, REPLY_COUNT);
    await seedReactionsAndVotes(client, postIds);
    await seedCommentReactions(client, [...commentIds, ...replyIds]);
    await seedPolls(client, postIds);
    const cleaned = await cleanUnsupportedReactions(client);
    const backfilled = await backfillExistingReactions(client);
    await client.query('COMMIT');
    console.log(`Listo: ${categories.length} categorias, ${postIds.length} posts, ${commentIds.length} comentarios, ${replyIds.length} respuestas, perfiles de trust actualizados ${backfilledTrustProfiles}, reacciones variadas ${reactionEmojis.join(' ')}, limpieza ${cleaned.posts} posts/${cleaned.comments} comentarios, backfill en ${backfilled.posts} posts y ${backfilled.comments} comentarios, ${AUTHOR_COUNT} autores anonimos simulados.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('No se pudo sembrar contenido demo:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
