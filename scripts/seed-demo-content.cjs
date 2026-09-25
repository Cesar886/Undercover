#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const POST_COUNT = Number.parseInt(process.env.DEMO_POSTS || '260', 10);
const COMMENT_COUNT = Number.parseInt(process.env.DEMO_COMMENTS || '780', 10);
const AUTHOR_COUNT = Number.parseInt(process.env.DEMO_AUTHORS || '90', 10);

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
];

const emojis = ['🔥', '👀', '💀', '🍿', '😬', '🫢'];

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
  for (let i = 0; i < COMMENT_COUNT; i += 1) {
    const postId = pick(postIds);
    const createdAt = daysAgo(randomInt(0, 14), randomInt(0, 23));
    await client.query(
      `INSERT INTO comments (
         post_id, anon_id, content, upvotes, downvotes, owner_token, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::uuid, $7)`,
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
  }
}

async function seedReactionsAndVotes(client, postIds) {
  const voterTokens = Array.from({ length: AUTHOR_COUNT * 2 }, (_, i) => `demo-voter-${i + 1}`);
  for (const postId of postIds) {
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
          [postId, token, pick(emojis)]
        );
      }
    }
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
    await seedComments(client, postIds);
    await seedReactionsAndVotes(client, postIds);
    await seedPolls(client, postIds);
    await client.query('COMMIT');
    console.log(`Listo: ${categories.length} categorias, ${postIds.length} posts, ${COMMENT_COUNT} comentarios, ${AUTHOR_COUNT} autores anonimos simulados.`);
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
