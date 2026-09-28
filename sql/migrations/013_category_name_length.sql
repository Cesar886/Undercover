ALTER TABLE categories
  ADD CONSTRAINT categories_name_length_check
  CHECK (char_length(name) BETWEEN 3 AND 32) NOT VALID;
