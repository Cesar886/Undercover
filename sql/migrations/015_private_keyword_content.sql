WITH normalized_posts AS (
  SELECT id,
         regexp_replace(
           lower(translate(content, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
           '[^a-z0-9]+', '', 'g'
         ) AS normalized_content
  FROM posts
  WHERE is_hidden = true
)
UPDATE posts AS p
SET is_hidden = false,
    owner_hidden = true,
    updated_at = NOW()
FROM normalized_posts AS normalized
WHERE p.id = normalized.id
  AND normalized.normalized_content LIKE ANY (ARRAY[
    '%daniel110a%', '%telegram%', '%amayrani%', '%daniel%',
    '%hacersepasar%', '%cesar%', '%hola123%'
  ]);

WITH normalized_comments AS (
  SELECT id,
         regexp_replace(
           lower(translate(content, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
           '[^a-z0-9]+', '', 'g'
         ) AS normalized_content
  FROM comments
  WHERE is_hidden = true
)
UPDATE comments AS c
SET is_hidden = false,
    owner_hidden = true,
    updated_at = NOW()
FROM normalized_comments AS normalized
WHERE c.id = normalized.id
  AND normalized.normalized_content LIKE ANY (ARRAY[
    '%daniel110a%', '%telegram%', '%amayrani%', '%daniel%',
    '%hacersepasar%', '%cesar%', '%hola123%'
  ]);
