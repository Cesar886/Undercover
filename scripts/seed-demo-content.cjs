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
  ['grupos-de-whatsapp', 'Grupos de WhatsApp', 'Capturas imaginarias y caos grupal'],
  ['semestre-maldito', 'Semestre Maldito', 'Cuando todo se junta'],
  ['profes-intensos', 'Profes Intensos', 'Tareas, indirectas y parciales sorpresa'],
  ['parejas-sospechosas', 'Parejas Sospechosas', 'Cuando algo no cuadra'],
  ['after-party', 'After Party', 'Lo que nadie admite el lunes'],
  ['crushes-anonimos', 'Crushes Anonimos', 'Confesiones sin remitente'],
  ['traiciones-light', 'Traiciones Light', 'Drama inventado para pruebas'],
  ['chismes-del-pasillo', 'Chismes del Pasillo', 'Versiones que cambian caminando'],
  ['deudas-y-promesas', 'Deudas y Promesas', 'Prestamos que se volvieron novela'],
  ['quien-fue', 'Quien Fue', 'Misterios pequenos de campus'],
  ['amistades-rotas', 'Amistades Rotas', 'Cuando el grupo se divide'],
  ['doble-check', 'Doble Check', 'Mensajes vistos y no contestados'],
  ['capturas-falsas', 'Capturas Falsas', 'Demos con puro contenido inventado'],
  ['indirectas', 'Indirectas', 'Para decir sin decir'],
  ['cosas-de-ex', 'Cosas de Ex', 'Historias que ya deberian superarse'],
  ['team-chisme', 'Team Chisme', 'Comentarios de espectadores profesionales'],
  ['anonimos-picantes', 'Anonimos Picantes', 'Drama subido de tono sin datos reales'],
  ['laboratorio-social', 'Laboratorio Social', 'Experimentos de convivencia'],
  ['parcial-de-drama', 'Parcial de Drama', 'Examen sorpresa de paciencia'],
  ['patio-central', 'Patio Central', 'Todo mundo pasa y todo mundo opina'],
  ['no-era-mi-novia', 'No Era Mi Novia', 'Excusas clasicas del multiverso'],
  ['citas-raras', 'Citas Raras', 'Planes que no salieron como se esperaba'],
  ['el-recibo', 'El Recibo', 'Pruebas ficticias para llenar feed'],
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
  ['quemones', 'Quemones', 'Quememos a todos'],
  ['infieles', 'Infieles', 'Entre todos nos cuidamos'],
  ['confesiones', 'Confesiones', 'Lo que no le dirias a nadie en persona'],
  ['stickers', 'Stickers', 'Tus mejores stickers aqui'],
];

const intros = [
  'Esto es inventado para demo, pero imaginate que',
  'Post ficticio numero serio: resulta que',
  'Sin nombres reales porque es prueba, pero dicen que',
  'Contenido de ejemplo: alguien conto que',
  'Demo con vibes de chisme: aparentemente',
  'Para probar el feed lleno, supuestamente',
  'Caso anonimo de laboratorio social:',
  'Si esto fuera real estaria fuerte, porque',
  'Reporte de pasillo, completamente ficticio: resulta que',
  'La version demo cuenta que',
  'Nadie confirmo nada, pero al parecer',
  'Abriendo expediente imaginario: alguien',
  'La comunidad esta preguntando por que',
  'Segun fuentes que no existen,',
  'Esto paso solo en la demo, pero',
  'Entre cafe y cafe se supo que',
  'La teoria de hoy dice que',
  'Mensaje sin remitente: aparentemente',
  'Antes de que pregunten, dicen que',
  'El algoritmo del drama detecto que',
  'Llegan nuevos detalles ficticios: resulta que',
  'Con cero pruebas y mucha imaginacion,',
  'La mesa de al lado asegura que',
  'En el grupo nadie sabe, pero',
  'El rumor de esta semana cuenta que',
  'Caso abierto para fines de prueba:',
  'La comunidad anonima comenta que',
];

const situations = [
  'le mandaban buenos dias a tres personas distintas antes de entrar a clase',
  'prometio exclusividad y luego aparecio en historias abrazando a su "grupo de estudio"',
  'pidio apuntes con carita triste y termino invitando cafe a medio salon',
  'dijo que no iba al after y salio etiquetado en cuatro fotos',
  'borro comentarios justo cuando llego su pareja al patio central',
  'tenia dos playlists romanticas con nombres sospechosamente parecidos',
  'se hizo el confundido cuando le preguntaron por el segundo celular',
  'subio una indirecta y tres personas pensaron que era para ellas',
  'juro que era su prima, pero nadie compro esa version',
  'cambio la foto de perfil cinco minutos despues del pleito',
  'se sento lejos en clase, pero reacciono a todas las historias',
  'llego tarde al parcial con una excusa que parecia guion de novela',
  'pidio discrecion y luego conto todo en el grupo equivocado',
  'dejo en visto a su crush y le escribio al ex a los dos minutos',
  'organizo una salida "casual" con lista de invitados demasiado calculada',
  'llego con una historia distinta dependiendo de quien preguntara',
  'repartio likes estrategicos y luego dijo que fue accidental',
  'confundio el chat de la clase con el chat de la familia',
  'prometio entregar el proyecto y desaparecio hasta la presentacion',
  'subio una foto vieja para provocar una reaccion nueva',
  'se ofrecio a guardar un secreto y lo conto con demasiados detalles',
  'cambio de mesa cada vez que entraba cierta persona',
  'dejo pistas en su estado y nego que fueran pistas',
  'llego a la reunion con un plan B, C y una excusa',
  'uso la misma frase romantica en tres conversaciones',
  'dijo que estaba ocupado y aparecio conectado toda la noche',
  'invito a estudiar y termino haciendo interrogatorio emocional',
  'pidio una opinion y se enojo con todas las respuestas',
  'se despidio del grupo y regreso con una captura nueva',
  'le puso nombre secreto a una relacion que nadie entendia',
  'fingio no reconocer a alguien que tenia guardado en favoritos',
  'llevo cafe para una persona y termino repartiendolo entre cinco',
  'reacciono con fuego a un mensaje que claramente no era para el',
  'dijo que todo estaba bien con una cara que decia lo contrario',
  'borro la evidencia pero olvido la notificacion',
  'se conecto justo cuando la conversacion se puso interesante',
  'organizo una encuesta para resolver algo que ya estaba decidido',
  'pidio segunda oportunidad antes de explicar la primera',
  'conto el final de una historia que todavia no empezaba',
  'se sento junto a su ex y llamo a eso madurez emocional',
  'prometio no hacer drama y creo tres grupos nuevos',
  'llego a clase con flores y dijo que eran para un experimento',
  'confundio una indirecta con una invitacion formal',
  'mando un audio de siete minutos para decir una sola cosa',
  'dejo su sesion abierta en la computadora equivocada',
  'aseguro que no le importaba y reviso cada reaccion',
  'pidio que nadie tomara fotos y luego subio un album completo',
  'aparecio en dos eventos al mismo tiempo segun sus historias',
  'ofrecio una explicacion que genero cuatro preguntas nuevas',
  'dijo que era coincidencia por quinta vez en la semana',
  'conocio a todo el grupo menos a la persona que lo esperaba',
  'hizo una lista de razones y olvido la razon principal',
  'llego temprano solo para elegir el asiento mas sospechoso',
  'convoco una reunion urgente por un mensaje de dos palabras',
  'puso una cancion triste y etiqueto a la persona equivocada',
  'juro que no habia visto el mensaje que tenia abierto',
  'pidio consejo y termino dando una conferencia',
  'dejo un regalo anonimo con una pista demasiado obvia',
  'se cambio de equipo justo despues de leer el chat',
  'publico una despedida y volvio a publicar en diez minutos',
  'llevo la cuenta exacta de quien saludo a quien',
  'dijo que queria paz y abrio otro debate',
  'convirtio una tarea sencilla en una saga de ocho episodios',
  'prometio llegar en cinco minutos y aparecio al siguiente dia',
];

const endings = [
  'La raza ya esta armando teoria con hilos completos.',
  'No hay pruebas reales, solo energia de pasillo y cafe frio.',
  'La categoria necesitaba movimiento y aqui esta el caos controlado.',
  'Alguien ya pidio segunda parte con recibos imaginarios.',
  'Todo ficticio, pero sirve para ver el sitio en modo concurrido.',
  'Los comentarios van a estar mejores que el post.',
  'Esto huele a final de semestre emocional.',
  'Que alguien saque las palomitas metaforicas.',
  'La libreta de teorias ya no tiene paginas disponibles.',
  'El grupo pidio contexto y recibio mas preguntas.',
  'Nadie fue etiquetado, pero todos se dieron por aludidos.',
  'La proxima actualizacion seguramente cambia la version.',
  'Esto merece una reunion que pudo ser un mensaje.',
  'El cafe se enfrio, pero el drama apenas empieza.',
  'La evidencia ficticia no convence, pero entretiene.',
  'El jurado del pasillo sigue deliberando.',
  'Al final, la categoria termino siendo protagonista.',
  'Se abre oficialmente la temporada de teorias.',
  'La explicacion no resolvio nada y eso la hace mejor.',
  'Todo queda registrado en el archivo de la demo.',
  'El silencio del chat tambien cuenta como respuesta.',
  'La comunidad ya eligio su version favorita.',
  'Alguien va a llegar tarde por seguir este hilo.',
  'La historia tiene mas vueltas que el horario del semestre.',
  'No hubo conclusion, pero si bastante contenido.',
  'El reporte queda pendiente de nuevos rumores imaginarios.',
  'Caso cerrado hasta que alguien encuentre otro detalle.',
  'La segunda parte ya se escribio sola.',
  'Esto fue un servicio publico para la curiosidad.',
  'La categoria sobrevivio otro dia de caos.',
  'La version oficial sigue en construccion.',
];

const commentBits = [
  'yo tambien vi algo parecido',
  'esto suena demasiado especifico',
  'necesito contexto pero ya elegi bando',
  'la version del pasillo dice otra cosa',
  'sin recibos no hay sentencia',
  'esto merece encuesta urgente',
  'me dio risa pero me dio miedo',
  'la U nunca decepciona',
  'alguien confirme si fue en cafeteria',
  'esta categoria va a explotar',
  'puro contenido de prueba, pero quedo sabroso',
  'ese plot twist no lo tenia',
  'yo venia por memes y encontre una investigacion',
  'esto necesita contexto, mapa y linea del tiempo',
  'la coartada esta flojita',
  'yo solo digo que hay patrones',
  'alguien archive esto antes de que desaparezca',
  'la encuesta se contesta sola',
  'me retiro hasta tener la segunda version',
  'esa explicacion abrio otro expediente',
  'el chat ya eligio villano',
  'nadie pregunto pero aqui va mi teoria',
  'esto parece tarea grupal y nadie trabajo',
  'confirmo que el pasillo estaba raro',
  'la evidencia emocional es contundente',
  'no tengo pruebas pero tampoco dudas',
  'se siente el final de semestre',
  'quien tenga la captura que la imagine',
  'esto merece nombre de operacion secreta',
  'la version corta no existe',
  'me quede por el chisme y por la categoria',
  'el silencio de esa persona dice bastante',
  'pongan contexto para la gente que llega tarde',
  'yo estaba en esa mesa y no vi nada',
  'la U produce mas giros que una serie',
  'esto escalo con mucha eficiencia',
  'se solicita testigo para fines completamente ficticios',
  'esa senal mixta ya parece semaforo',
  'el recibo puede ser imaginario pero el drama no',
  'necesito leer los comentarios en orden cronologico',
  'nadie salga del grupo todavia',
  'la teoria del cafe frio gana por ahora',
  'esto pide segunda temporada',
  'me niego a creer que fue coincidencia',
  'el algoritmo del drama hizo su trabajo',
  'punto para quien noto el detalle',
  'la explicacion llego tarde pero llego',
  'esto va directo a favoritos',
  'no juzgo, pero tomo notas',
  'la categoria ya tiene personalidad propia',
];

const replyBits = [
  'exacto, eso mismo pense',
  'no, pero espera, falta una parte',
  'yo creo que aqui hay mas contexto',
  'esa respuesta cambio todo',
  'me dio risa como lo dijiste',
  'confirmo la energia, aunque no los hechos',
  'esta teoria si tiene sentido',
  'yo venia a leer y termine opinando',
  'ahi discrepo tantito',
  'esto se puso mejor que el post',
  'alguien tenia que decirlo',
  'la respuesta merece estar arriba',
  'jajaja esa fue muy especifica',
  'aqui ya se armo mini hilo',
  'me convenciste con cero pruebas',
  'esa parte nadie la esta viendo',
  'la cronologia esta sospechosa',
  'necesitamos mapa del drama',
  'esta respuesta tiene mas evidencia que el post',
  'yo le creo a esta version',
  'la forma en que todos entendimos',
  'esto ya parece audiencia publica',
  'dato pequeno pero importante',
  'se tenia que investigar y se investigo',
  'la comunidad haciendo su trabajo',
  'no estaba listo para ese detalle',
  'ahi esta el verdadero plot twist',
  'esta respuesta explica demasiado',
  'me sumo a esta teoria',
  'aqui hay material para segunda parte',
];

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
  return `${pick(intros)} ${pick(situations)}. ${pick(endings)} #demo${i + 1}`;
}

function makeCommentContent(i) {
  const suffix = randomInt(1, 5) === 1 ? ' jajaja' : '';
  return `${pick(commentBits)}${suffix} (${i + 1})`;
}

function makeReplyContent(i) {
  const intro = randomInt(1, 4) === 1 ? '@anon ' : '';
  const tail = randomInt(1, 6) === 1 ? ' necesito actualizacion' : '';
  return `${intro}${pick(replyBits)}${tail} [respuesta demo ${i + 1}]`;
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
      ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await client.query(`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS owner_token UUID,
      ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT FALSE
  `);
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
  const bumpedAt = new Date(createdAt.getTime() + randomInt(0, 72) * 60 * 60 * 1000);
  const category = pick(categories.filter((categorySlug) => categorySlug !== 'stickers'));
  const result = await client.query(
    `INSERT INTO posts (
       anon_id, content, category, upvotes, downvotes, owner_token, created_at, last_bumped_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8)
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
    ]
  );
  return result.rows[0].id;
}

async function seedComments(client, postIds) {
  const commentIds = [];
  for (let i = 0; i < COMMENT_COUNT; i += 1) {
    const postId = pick(postIds);
    const createdAt = daysAgo(randomInt(0, 14), randomInt(0, 23));
    const inserted = await client.query(
      `INSERT INTO comments (
         post_id, anon_id, content, upvotes, downvotes, owner_token, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::uuid, $7)
       RETURNING id`,
      [
        postId,
        pick(authors),
        makeCommentContent(i),
        randomInt(0, 70),
        randomInt(0, 18),
        ownerToken(1000 + i),
        createdAt,
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
    const inserted = await client.query(
      `INSERT INTO comments (
         post_id, parent_id, anon_id, content, upvotes, downvotes, owner_token, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8)
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
    console.log(`Listo: ${categories.length} categorias, ${postIds.length} posts, ${commentIds.length} comentarios, ${replyIds.length} respuestas, reacciones variadas ${reactionEmojis.join(' ')}, limpieza ${cleaned.posts} posts/${cleaned.comments} comentarios, backfill en ${backfilled.posts} posts y ${backfilled.comments} comentarios, ${AUTHOR_COUNT} autores anonimos simulados.`);
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
