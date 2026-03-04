-- ============================================================================
-- Seed data: 13 South Sudanese test profiles
-- Note: These are inserted directly into User/Profile/Photo tables.
-- In production, users are created through Supabase Auth (trigger auto-creates rows).
-- For seeding, we skip auth_id since these are test-only profiles.
-- ============================================================================

-- Adau
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-adau', 'adau@seed.local', 'Adau', '2002-03-15', 'woman', 'US', 'Houston', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-adau-profile', 'seed-adau', 'Braids queen & gold lover • That smile is real', 'Something serious', 'Something serious', 'Dinka', 180, 'she/her', 'Bachelor''s degree', 'No children', 'Nursing Student', 'University of Houston',
  '["Fashion", "Art", "Travel", "Photography"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "✈️", "label": "World Traveler"}, {"emoji": "🎨", "label": "Creative"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-adau-p1', 'seed-adau', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p1.jpg', 0, true),
  ('seed-adau-p2', 'seed-adau', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p2.jpg', 1, false),
  ('seed-adau-p3', 'seed-adau', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p7.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Abuk
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-abuk', 'abuk@seed.local', 'Abuk', '1999-07-22', 'woman', 'US', 'Washington DC', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-abuk-profile', 'seed-abuk', 'Event planner • Orange top & big energy', 'Let''s see where it goes', 'Figuring it out', 'Bari', 170, 'she/her', 'Bachelor''s degree', 'No children', 'Event Planner', 'Howard University',
  '["Events", "Fashion", "Dancing", "Community"]'::jsonb,
  '[{"emoji": "🌿", "label": "Bari"}, {"emoji": "🎉", "label": "Party"}, {"emoji": "💃", "label": "Dance"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-abuk-p1', 'seed-abuk', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p2.jpg', 0, true),
  ('seed-abuk-p2', 'seed-abuk', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p1.jpg', 1, false),
  ('seed-abuk-p3', 'seed-abuk', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p4.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Nyirou
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-nyirou', 'nyirou@seed.local', 'Nyirou', '2000-01-10', 'woman', 'US', 'Minneapolis', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-nyirou-profile', 'seed-nyirou', 'Photographer • Lakeside soul, blue knit', 'Something serious', 'Something serious', 'Nuer', 175, 'she/her', 'Bachelor''s degree', 'No children', 'Photographer', 'Minneapolis College of Art',
  '["Photography", "Nature", "Art", "Travel"]'::jsonb,
  '[{"emoji": "🐆", "label": "Nuer"}, {"emoji": "📷", "label": "Photo"}, {"emoji": "🌊", "label": "Water"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-nyirou-p1', 'seed-nyirou', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p3.jpg', 0, true),
  ('seed-nyirou-p2', 'seed-nyirou', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p5.jpg', 1, false),
  ('seed-nyirou-p3', 'seed-nyirou', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p2.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Athieng
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-athieng', 'athieng@seed.local', 'Athieng', '2001-05-18', 'woman', 'US', 'Charlotte', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-athieng-profile', 'seed-athieng', 'Fashion Designer • Green/purple tie-dye dress', 'Something serious', 'Something serious', 'Bari', 173, 'she/her', 'Bachelor''s degree', 'No children', 'Fashion Designer', 'NC State University',
  '["Fashion", "Design", "Culture", "Sewing"]'::jsonb,
  '[{"emoji": "🌿", "label": "Bari"}, {"emoji": "🎨", "label": "Creative"}, {"emoji": "👗", "label": "Designer"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-athieng-p1', 'seed-athieng', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p4.jpg', 0, true),
  ('seed-athieng-p2', 'seed-athieng', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p3.jpg', 1, false),
  ('seed-athieng-p3', 'seed-athieng', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p7.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Yar
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-yar', 'yar@seed.local', 'Yar', '2005-09-03', 'woman', 'US', 'Baltimore', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-yar-profile', 'seed-yar', 'Community Worker • White head wrap, village heart', 'Marriage-minded', 'Marriage-minded', 'Dinka', 165, 'she/her', 'Associate''s degree', 'No children', 'Community Worker', 'Community College of Baltimore',
  '["Community", "Faith", "Cooking", "Family"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "✝️", "label": "Faith"}, {"emoji": "🌍", "label": "Junub"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-yar-p1', 'seed-yar', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p5.jpg', 0, true),
  ('seed-yar-p2', 'seed-yar', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p4.jpg', 1, false),
  ('seed-yar-p3', 'seed-yar', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p1.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Akech
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-akech', 'akech@seed.local', 'Akech', '2002-11-25', 'woman', 'US', 'Phoenix', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-akech-profile', 'seed-akech', 'Personal Trainer • Festival season, Nike headband', 'Let''s see where it goes', 'Figuring it out', 'Shilluk', 173, 'she/her', 'Bachelor''s degree', 'No children', 'Personal Trainer', 'Arizona State University',
  '["Fitness", "Festivals", "Running", "Travel"]'::jsonb,
  '[{"emoji": "🏛️", "label": "Shilluk"}, {"emoji": "🏃", "label": "Runner"}, {"emoji": "🎶", "label": "Festivals"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-akech-p1', 'seed-akech', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p6.jpg', 0, true),
  ('seed-akech-p2', 'seed-akech', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p2.jpg', 1, false),
  ('seed-akech-p3', 'seed-akech', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p3.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Nyandeng
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-nyandeng', 'nyandeng@seed.local', 'Nyandeng', '2003-04-12', 'woman', 'US', 'Washington DC', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-nyandeng-profile', 'seed-nyandeng', 'Psychology Student • Cornrows, tan sweater', 'Something serious', 'Something serious', 'Dinka', 168, 'she/her', 'Bachelor''s degree', 'No children', 'Psychology Student', 'George Washington University',
  '["Psychology", "Reading", "Self-care", "Coffee"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "📖", "label": "Reader"}, {"emoji": "🧠", "label": "Mind"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-nyandeng-p1', 'seed-nyandeng', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p7.jpg', 0, true),
  ('seed-nyandeng-p2', 'seed-nyandeng', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p6.jpg', 1, false),
  ('seed-nyandeng-p3', 'seed-nyandeng', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p5.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Nyibol
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-nyibol', 'nyibol@seed.local', 'Nyibol', '2004-08-30', 'woman', 'US', 'Nashville', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-nyibol-profile', 'seed-nyibol', 'Model & Student • White tank top, name necklace', 'Something serious', 'Something serious', 'Dinka', 175, 'she/her', 'Bachelor''s degree', 'No children', 'Model & Student', 'Tennessee State University',
  '["Fashion", "Cooking", "Thrifting", "Music"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "🍲", "label": "Foodie"}, {"emoji": "✨", "label": "Melanin"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-nyibol-p1', 'seed-nyibol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p8.jpg', 0, true),
  ('seed-nyibol-p2', 'seed-nyibol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p1.jpg', 1, false),
  ('seed-nyibol-p3', 'seed-nyibol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p6.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Achol
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-achol', 'achol@seed.local', 'Achol', '2001-02-14', 'woman', 'US', 'New York', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-achol-profile', 'seed-achol', 'Model • Beach editorial, Sonia Tucker', 'Let''s see where it goes', 'Figuring it out', 'Nuer', 178, 'she/her', 'High school', 'No children', 'High Fashion Model', '',
  '["Fashion", "Travel", "Dancing", "Cooking"]'::jsonb,
  '[{"emoji": "🐆", "label": "Nuer"}, {"emoji": "✨", "label": "Rising Star"}, {"emoji": "💃", "label": "Dance"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-achol-p1', 'seed-achol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p9.jpg', 0, true),
  ('seed-achol-p2', 'seed-achol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p3.jpg', 1, false),
  ('seed-achol-p3', 'seed-achol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p8.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Akuol
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-akuol', 'akuol@seed.local', 'Akuol', '2001-06-20', 'woman', 'US', 'Atlanta', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-akuol-profile', 'seed-akuol', 'Model & MUA • Malaan Ajang glamour', 'Something serious', 'Something serious', 'Dinka', 178, 'she/her', 'Bachelor''s degree', 'No children', 'Model & MUA', 'Spelman College',
  '["Beauty", "Fashion", "Art", "Photography"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "👑", "label": "Queen"}, {"emoji": "💄", "label": "Glam"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-akuol-p1', 'seed-akuol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p10.jpg', 0, true),
  ('seed-akuol-p2', 'seed-akuol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p9.jpg', 1, false),
  ('seed-akuol-p3', 'seed-akuol', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p7.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Makuei
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-makuei', 'makuei@seed.local', 'Makuei', '1998-12-05', 'man', 'SS', 'Bor', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-makuei-profile', 'seed-makuei', 'Cultural Ambassador • Traditional beaded headpiece, cattle', 'Marriage-minded', 'Marriage-minded', 'Dinka', 193, 'he/him', 'High school', 'No children', 'Model & Cultural Ambassador', '',
  '["Culture", "Cattle", "Travel", "Photography"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "🐄", "label": "Herder"}, {"emoji": "🎭", "label": "Cultural"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-makuei-p1', 'seed-makuei', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p11.jpg', 0, true),
  ('seed-makuei-p2', 'seed-makuei', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p12.jpg', 1, false),
  ('seed-makuei-p3', 'seed-makuei', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p13.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Atem
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-atem', 'atem@seed.local', 'Atem', '2000-10-08', 'man', 'GB', 'London', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-atem-profile', 'seed-atem', 'Model & Music Producer • Yellow leather jacket', 'Something serious', 'Something serious', 'Shilluk', 185, 'he/him', 'Bachelor''s degree', 'No children', 'Model & Music Producer', 'University of Westminster',
  '["Music", "Fashion", "Production", "Nightlife"]'::jsonb,
  '[{"emoji": "🏛️", "label": "Shilluk"}, {"emoji": "🎵", "label": "Music"}, {"emoji": "🔥", "label": "Streetwear"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-atem-p1', 'seed-atem', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p12.jpg', 0, true),
  ('seed-atem-p2', 'seed-atem', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p11.jpg', 1, false),
  ('seed-atem-p3', 'seed-atem', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p13.jpg', 2, false)
ON CONFLICT DO NOTHING;

-- Garang
INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, "isVerified", "isActive", "updatedAt")
VALUES ('seed-garang', 'garang@seed.local', 'Garang', '1997-03-28', 'man', 'US', 'College Park', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Profile" (id, "userId", bio, "lookingFor", "datingIntentions", ethnicity, "heightCm", pronouns, education, children, job, school, interests, stickers, "profileComplete", "updatedAt")
VALUES ('seed-garang-profile', 'seed-garang', 'Software Engineer • Horseback, traditional garb', 'Marriage-minded', 'Marriage-minded', 'Dinka', 193, 'he/him', 'Bachelor''s degree', 'Want children someday', 'Software Engineer', 'University of Maryland',
  '["Tech", "Community", "Basketball", "Faith"]'::jsonb,
  '[{"emoji": "🦁", "label": "Dinka"}, {"emoji": "💻", "label": "Tech"}, {"emoji": "🏀", "label": "Basketball"}]'::jsonb,
  true, NOW())
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES
  ('seed-garang-p1', 'seed-garang', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p13.jpg', 0, true),
  ('seed-garang-p2', 'seed-garang', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p12.jpg', 1, false),
  ('seed-garang-p3', 'seed-garang', 'https://res.cloudinary.com/placeholder/image/upload/junubin/seed/p11.jpg', 2, false)
ON CONFLICT DO NOTHING;
