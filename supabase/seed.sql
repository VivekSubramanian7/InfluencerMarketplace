-- Seed data: 5 brands, 30 creators, offerings, campaigns, conversations, deals.
-- All users have password: password123
-- The handle_new_user trigger auto-creates profiles rows from auth.users metadata.

-- ============================================================
-- 1. Auth users (5 brands + 30 creators)
-- ============================================================

-- Brands
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, reauthentication_token, phone_change, phone_change_token, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'brand1@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"brand","display_name":"NovaStar Nutrition"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'brand2@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"brand","display_name":"Velvet & Vine"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'brand3@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"brand","display_name":"PeakFit Gear"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'brand4@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"brand","display_name":"Luminary Studios"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'brand5@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"brand","display_name":"GreenLeaf Co"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb);

-- Creators
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, reauthentication_token, phone_change, phone_change_token, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'creator1@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Maya Chen"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'creator2@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Jake Morrison"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'creator3@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Priya Sharma"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'creator4@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Liam O''Brien"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'creator5@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Sofia Rodriguez"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'creator6@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Tyler Washington"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'creator7@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Aiko Tanaka"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'creator8@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Marcus Evans"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'creator9@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Nina Petrova"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'creator10@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Diego Fuentes"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'creator11@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Emma Larsson"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'creator12@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Kwame Asante"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'creator13@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Chloe Bennett"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000014', 'authenticated', 'authenticated', 'creator14@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Raj Patel"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000015', 'authenticated', 'authenticated', 'creator15@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Olivia Kim"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000016', 'authenticated', 'authenticated', 'creator16@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Hassan Ali"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000017', 'authenticated', 'authenticated', 'creator17@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Mia Thompson"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000018', 'authenticated', 'authenticated', 'creator18@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Yuki Nakamura"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000019', 'authenticated', 'authenticated', 'creator19@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Alex Rivera"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000020', 'authenticated', 'authenticated', 'creator20@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Fatima Okafor"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated', 'creator21@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Ben Cooper"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000022', 'authenticated', 'authenticated', 'creator22@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Zara Ibrahim"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000023', 'authenticated', 'authenticated', 'creator23@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Leo Martinez"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000024', 'authenticated', 'authenticated', 'creator24@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Ava Johansson"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000025', 'authenticated', 'authenticated', 'creator25@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Omar Haddad"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000026', 'authenticated', 'authenticated', 'creator26@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Ruby Nguyen"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000027', 'authenticated', 'authenticated', 'creator27@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Elijah Brown"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000028', 'authenticated', 'authenticated', 'creator28@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Sana Mirza"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000029', 'authenticated', 'authenticated', 'creator29@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Finn McCarthy"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000030', 'authenticated', 'authenticated', 'creator30@demo.com', crypt('password123', gen_salt('bf')), now(), '{"role":"creator","display_name":"Isla Park"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb);

-- Auth identities (required for Supabase email login to work)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select id, id, json_build_object('sub', id, 'email', email)::jsonb, 'email', id::text, now(), now(), now()
from auth.users where email like '%@demo.com';

-- ============================================================
-- 2. Brand profiles
-- ============================================================

insert into public.brand_profiles (user_id, company, website, description, pref_niches, pref_types, outreach_template)
values
  ('b0000000-0000-0000-0000-000000000001', 'NovaStar Nutrition', 'https://novastarnutrition.com', 'Premium sports nutrition and supplements for athletes and fitness enthusiasts.', '{fitness,health,wellness}', '{dedicated_video,integration}', 'Hey! NovaStar here — we make premium sports nutrition and would love to work with you on some content. Interested in chatting about a collab?'),
  ('b0000000-0000-0000-0000-000000000002', 'Velvet & Vine', 'https://velvetandvine.com', 'Sustainable fashion and accessories for the modern minimalist.', '{fashion,lifestyle,sustainability}', '{short_form_post,ugc_video}', 'Hi there! We''re Velvet & Vine, a sustainable fashion brand. Love your style — would you be interested in creating some content with us?'),
  ('b0000000-0000-0000-0000-000000000003', 'PeakFit Gear', 'https://peakfitgear.com', 'Technical outdoor and fitness gear tested in extreme conditions.', '{fitness,outdoors,sports}', '{dedicated_video,short_form_post}', 'PeakFit Gear here! We make technical fitness gear and think your audience would love what we do. Let''s talk!'),
  ('b0000000-0000-0000-0000-000000000004', 'Luminary Studios', 'https://luminarystudios.com', 'Mobile-first creative tools for content creators — video editing, graphics, and templates.', '{tech,education,creativity}', '{integration,ugc_video}', 'Hey! Luminary Studios builds creative tools for content creators like you. Want to try our app and share your honest take?'),
  ('b0000000-0000-0000-0000-000000000005', 'GreenLeaf Co', 'https://greenleafco.com', 'Organic skincare and wellness products with transparent sourcing.', '{beauty,wellness,sustainability}', '{short_form_post,dedicated_video}', 'Hi! GreenLeaf Co here — we make clean, organic skincare. Your values align perfectly with ours. Interested in a partnership?');

-- Brand products
insert into public.brand_products (brand_id, name, url, description)
values
  ('b0000000-0000-0000-0000-000000000001', 'ProWhey Isolate', 'https://novastarnutrition.com/prowhey', 'Grass-fed whey protein isolate, 27g protein per scoop'),
  ('b0000000-0000-0000-0000-000000000001', 'HydraFuel Electrolytes', 'https://novastarnutrition.com/hydrafuel', 'Zero-sugar electrolyte mix for intense training'),
  ('b0000000-0000-0000-0000-000000000002', 'The Everyday Tote', 'https://velvetandvine.com/everyday-tote', 'Recycled canvas tote bag, hand-dyed'),
  ('b0000000-0000-0000-0000-000000000002', 'Linen Basics Collection', 'https://velvetandvine.com/linen-basics', 'Organic linen essentials in earth tones'),
  ('b0000000-0000-0000-0000-000000000003', 'TrailRunner Pro Jacket', 'https://peakfitgear.com/trailrunner', 'Ultralight waterproof running jacket'),
  ('b0000000-0000-0000-0000-000000000003', 'GripMax Training Gloves', 'https://peakfitgear.com/gripmax', 'Full-finger training gloves with wrist support'),
  ('b0000000-0000-0000-0000-000000000004', 'Luminary Edit Pro', 'https://luminarystudios.com/edit-pro', 'AI-powered mobile video editor'),
  ('b0000000-0000-0000-0000-000000000005', 'Glow Serum', 'https://greenleafco.com/glow-serum', 'Vitamin C + hyaluronic acid serum, organic'),
  ('b0000000-0000-0000-0000-000000000005', 'Calm Balm', 'https://greenleafco.com/calm-balm', 'CBD-infused recovery balm for post-workout');

-- ============================================================
-- 3. Creator profiles (all live)
-- ============================================================

insert into public.creator_profiles (user_id, handle, bio, niches, country, languages, status)
values
  ('c0000000-0000-0000-0000-000000000001', 'mayachen', 'Filmmaker & visual storyteller. Cinematic brand content that feels real.', '{lifestyle,travel,film}', 'US', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000002', 'jakemorrison', 'Fitness creator. 500K on YouTube. Honest supplement reviews.', '{fitness,health,nutrition}', 'US', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000003', 'priyasharma', 'Tech reviewer with a design eye. Making complex tools simple.', '{tech,education,gadgets}', 'IN', '{en,hi}', 'live'),
  ('c0000000-0000-0000-0000-000000000004', 'liamobrien', 'Outdoor adventure + fitness. If it gets my heart rate up, I''m in.', '{fitness,outdoors,adventure}', 'IE', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000005', 'sofiarod', 'Fashion & sustainability advocate. Slow fashion, fast laughs.', '{fashion,sustainability,comedy}', 'MX', '{en,es}', 'live'),
  ('c0000000-0000-0000-0000-000000000006', 'tylerwash', 'Gaming & tech. Building PCs, breaking controllers.', '{gaming,tech,entertainment}', 'US', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000007', 'aikotanaka', 'Beauty & skincare from Tokyo. J-beauty translated for the world.', '{beauty,skincare,lifestyle}', 'JP', '{en,ja}', 'live'),
  ('c0000000-0000-0000-0000-000000000008', 'marcusevans', 'Finance bro (the good kind). Making money talk less boring.', '{finance,education,business}', 'UK', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000009', 'ninapetrova', 'Yoga & mindfulness creator. Breathing exercises > everything.', '{wellness,fitness,mindfulness}', 'BG', '{en,bg}', 'live'),
  ('c0000000-0000-0000-0000-000000000010', 'diegofuentes', 'Food & cooking. Street food to fine dining, I eat it all.', '{food,cooking,travel}', 'CO', '{en,es}', 'live'),
  ('c0000000-0000-0000-0000-000000000011', 'emmalarsson', 'Interior design & DIY. Making rentals look expensive.', '{home,diy,design}', 'SE', '{en,sv}', 'live'),
  ('c0000000-0000-0000-0000-000000000012', 'kwameasante', 'Music producer & creator. Beats, vlogs, and the creative process.', '{music,creativity,entertainment}', 'GH', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000013', 'chloebennett', 'Mom life + product reviews. If it survives my toddler, it''s good.', '{parenting,lifestyle,reviews}', 'US', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000014', 'rajpatel', 'SaaS tutorials & startup advice. Building in public.', '{tech,business,education}', 'IN', '{en,hi}', 'live'),
  ('c0000000-0000-0000-0000-000000000015', 'oliviakim', 'K-beauty expert & lifestyle vlogger. Routines that actually work.', '{beauty,skincare,kbeauty}', 'KR', '{en,ko}', 'live'),
  ('c0000000-0000-0000-0000-000000000016', 'hassanali', 'Photography & visual art. Landscapes that make you stop scrolling.', '{photography,art,travel}', 'AE', '{en,ar}', 'live'),
  ('c0000000-0000-0000-0000-000000000017', 'miathompson', 'Running coach & marathon content. Sub-3 or bust.', '{fitness,running,sports}', 'AU', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000018', 'yukinakamura', 'Anime culture & Japanese street fashion. Harajuku native.', '{fashion,anime,culture}', 'JP', '{en,ja}', 'live'),
  ('c0000000-0000-0000-0000-000000000019', 'alexrivera', 'Car reviews & automotive content. Enthusiast, not a dealer.', '{automotive,tech,reviews}', 'US', '{en,es}', 'live'),
  ('c0000000-0000-0000-0000-000000000020', 'fatimaokafor', 'Natural hair care & beauty for melanin-rich skin.', '{beauty,haircare,lifestyle}', 'NG', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000021', 'bencooper', 'Home gym builds & budget fitness. Gains don''t need a membership.', '{fitness,home,diy}', 'US', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000022', 'zaraibrahim', 'Modest fashion & travel. Exploring the world in style.', '{fashion,travel,culture}', 'UK', '{en,ar}', 'live'),
  ('c0000000-0000-0000-0000-000000000023', 'leomartinez', 'Street photography & urban exploration. Cities after dark.', '{photography,urban,art}', 'AR', '{en,es}', 'live'),
  ('c0000000-0000-0000-0000-000000000024', 'avajohansson', 'Plant-based recipes & sustainable living. Yes, I get enough protein.', '{food,vegan,sustainability}', 'SE', '{en,sv}', 'live'),
  ('c0000000-0000-0000-0000-000000000025', 'omarhaddad', 'Calisthenics & bodyweight training. No gym, no problem.', '{fitness,calisthenics,health}', 'MA', '{en,fr,ar}', 'live'),
  ('c0000000-0000-0000-0000-000000000026', 'rubynguyen', 'Nail art & aesthetic content. Tiny canvases, big energy.', '{beauty,nailart,aesthetic}', 'VN', '{en,vi}', 'live'),
  ('c0000000-0000-0000-0000-000000000027', 'elijahbrown', 'Basketball training & sports motivation. From park courts to pro.', '{sports,basketball,fitness}', 'US', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000028', 'sanamirza', 'Book reviews & literary content. Your next read is here.', '{books,education,culture}', 'PK', '{en,ur}', 'live'),
  ('c0000000-0000-0000-0000-000000000029', 'finnmccarthy', 'Surfing & ocean conservation. Salt water is my therapy.', '{surfing,outdoors,sustainability}', 'IE', '{en}', 'live'),
  ('c0000000-0000-0000-0000-000000000030', 'islapark', 'Dance choreography & performance. Moving bodies, moving people.', '{dance,entertainment,fitness}', 'KR', '{en,ko}', 'live');

-- ============================================================
-- 4. Connected accounts (social stats for ~20 creators)
-- ============================================================

insert into public.connected_accounts (creator_id, platform, platform_handle, follower_count, avg_views, engagement_rate, verification_status, last_synced_at)
values
  ('c0000000-0000-0000-0000-000000000001', 'youtube', 'MayaChenFilms', 280000, 45000, 4.20, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000001', 'instagram', 'mayachen', 190000, null, 3.80, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000002', 'youtube', 'JakeMorrisonFit', 520000, 85000, 5.10, 'verified', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000002', 'tiktok', 'jakemorrison', 310000, 120000, 6.50, 'verified', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000003', 'youtube', 'PriyaTechReviews', 150000, 22000, 3.90, 'verified', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000004', 'youtube', 'LiamOutdoors', 95000, 18000, 4.70, 'verified', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000004', 'instagram', 'liamobrien_', 72000, null, 5.20, 'verified', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000005', 'tiktok', 'sofiarod', 680000, 200000, 7.80, 'verified', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000005', 'instagram', 'sofiarod', 240000, null, 4.50, 'verified', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000007', 'youtube', 'AikoBeautyTokyo', 340000, 55000, 4.00, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000007', 'instagram', 'aikotanaka', 410000, null, 5.30, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000009', 'youtube', 'NinaPetrovaYoga', 88000, 12000, 6.10, 'verified', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000010', 'tiktok', 'diegoeats', 450000, 180000, 8.20, 'verified', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000010', 'youtube', 'DiegoFuentesFood', 120000, 25000, 4.80, 'verified', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000015', 'youtube', 'OliviaKBeauty', 260000, 40000, 4.40, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000015', 'instagram', 'oliviakim', 380000, null, 5.60, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000017', 'youtube', 'MiaRunsMarathons', 65000, 9000, 7.20, 'verified', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000017', 'tiktok', 'miathompson', 140000, 45000, 5.90, 'verified', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000020', 'youtube', 'FatimaNaturalHair', 175000, 30000, 5.50, 'verified', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000020', 'instagram', 'fatimaokafor', 220000, null, 4.90, 'verified', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000025', 'youtube', 'OmarCalisthenics', 200000, 35000, 6.30, 'verified', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000030', 'tiktok', 'islapark', 920000, 350000, 9.10, 'verified', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000030', 'instagram', 'islapark_', 510000, null, 6.70, 'verified', now() - interval '1 day');

-- ============================================================
-- 5. Offerings (1-3 per creator)
-- ============================================================

insert into public.offerings (id, creator_id, type, title, description, price_cents, turnaround_days, revision_limit)
values
  -- Maya Chen
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'dedicated_video', 'Cinematic Brand Film', 'Full cinematic brand video (2-5 min), shot and edited by me.', 250000, 21, 2),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'short_form_post', 'Instagram Reel', 'Aesthetic 30-60s Reel featuring your product in my style.', 80000, 10, 1),
  -- Jake Morrison
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'dedicated_video', 'Honest Product Review', 'In-depth YouTube review (8-12 min) with my honest take.', 180000, 14, 2),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'integration', 'Workout Integration', '60-90s integration in a workout video. Natural fit only.', 120000, 10, 1),
  -- Priya Sharma
  ('a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', 'dedicated_video', 'Tech Deep Dive', 'Full review video (10-15 min) with pros, cons, and verdict.', 150000, 14, 2),
  ('a0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000003', 'integration', 'App Walkthrough', '60-90s app demo integrated into a tips video.', 90000, 7, 1),
  -- Liam O'Brien
  ('a0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000004', 'dedicated_video', 'Trail Test Video', 'I take your gear on a real trail run and film the experience.', 200000, 21, 2),
  -- Sofia Rodriguez
  ('a0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005', 'short_form_post', 'TikTok Styling Video', 'Styling your piece in 3 different outfits, 60s TikTok.', 95000, 7, 1),
  ('a0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000005', 'ugc_video', 'UGC Lookbook', 'Raw UGC footage of me styling your items. You post, not me.', 60000, 5, 2),
  -- Tyler Washington
  ('a0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000006', 'dedicated_video', 'Gaming Setup Review', 'Full video review of gaming peripherals or hardware.', 130000, 14, 1),
  -- Aiko Tanaka
  ('a0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000007', 'dedicated_video', 'J-Beauty Routine Feature', 'Full skincare routine video featuring your product as a hero.', 220000, 14, 2),
  ('a0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000007', 'short_form_post', 'Quick Beauty Tip Reel', '30s Reel showing one tip using your product.', 70000, 5, 1),
  -- Marcus Evans
  ('a0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000008', 'integration', 'Finance App Integration', '60-90s casual integration in a money-tips video.', 100000, 10, 1),
  -- Nina Petrova
  ('a0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000009', 'dedicated_video', 'Wellness Product Spotlight', 'Mindful review woven into a yoga/wellness session.', 110000, 14, 2),
  -- Diego Fuentes
  ('a0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000010', 'dedicated_video', 'Cooking With Your Product', 'Recipe video (5-8 min) featuring your food product.', 140000, 10, 1),
  ('a0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000010', 'short_form_post', 'Street Food TikTok', '60s street-food-style TikTok featuring your brand.', 75000, 5, 1),
  -- Emma Larsson
  ('a0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000011', 'ugc_video', 'Home Styling UGC', 'Raw UGC footage of your home product in my apartment.', 55000, 7, 2),
  -- Kwame Asante
  ('a0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000012', 'integration', 'Music Vlog Integration', '60-90s integration in a studio vlog or beat-making session.', 85000, 10, 1),
  -- Chloe Bennett
  ('a0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000013', 'dedicated_video', 'Family Product Test', 'Honest family product test video, toddler-approved rating.', 95000, 14, 2),
  -- Raj Patel
  ('a0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000014', 'dedicated_video', 'SaaS Walkthrough', 'Full tutorial/review of your software product (10-15 min).', 160000, 14, 2),
  -- Olivia Kim
  ('a0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000015', 'dedicated_video', 'K-Beauty Routine', 'Full skincare or makeup routine featuring your product.', 200000, 14, 2),
  ('a0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000015', 'short_form_post', 'Before & After Reel', '30s before/after transformation Reel.', 85000, 7, 1),
  -- Mia Thompson
  ('a0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000017', 'dedicated_video', 'Gear Run Test', 'I run a half marathon in your gear and review it honestly.', 170000, 21, 2),
  ('a0000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000017', 'short_form_post', 'Running TikTok', '60s run clip with your product visible throughout.', 65000, 7, 1),
  -- Fatima Okafor
  ('a0000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000020', 'dedicated_video', 'Hair Care Routine', 'Full natural hair care routine video with your product.', 160000, 14, 2),
  -- Omar Haddad
  ('a0000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000025', 'dedicated_video', 'Calisthenics Challenge', 'Workout challenge video featuring your supplement or gear.', 140000, 14, 1),
  -- Isla Park
  ('a0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000030', 'short_form_post', 'Dance Collab TikTok', 'Choreographed TikTok featuring your brand.', 120000, 5, 1),
  ('a0000000-0000-0000-0000-000000000028', 'c0000000-0000-0000-0000-000000000030', 'ugc_video', 'Dance UGC Package', 'Raw dance footage with your product for your channels.', 90000, 7, 2);

-- ============================================================
-- 6. Portfolio items
-- ============================================================

insert into public.portfolio_items (creator_id, media_url, caption)
values
  ('c0000000-0000-0000-0000-000000000001', 'https://youtube.com/watch?v=example1', 'Cinematic travel vlog — Kyoto at dawn'),
  ('c0000000-0000-0000-0000-000000000001', 'https://youtube.com/watch?v=example2', 'Brand film for artisan coffee company'),
  ('c0000000-0000-0000-0000-000000000002', 'https://youtube.com/watch?v=example3', 'Top 5 protein powders — honest ranking'),
  ('c0000000-0000-0000-0000-000000000002', 'https://tiktok.com/@jakemorrison/video/example4', '30-day fitness transformation'),
  ('c0000000-0000-0000-0000-000000000005', 'https://tiktok.com/@sofiarod/video/example5', '3 outfits from one thrift haul'),
  ('c0000000-0000-0000-0000-000000000007', 'https://youtube.com/watch?v=example6', 'My 10-step evening skincare routine'),
  ('c0000000-0000-0000-0000-000000000010', 'https://tiktok.com/@diegoeats/video/example7', 'Street tacos in Mexico City — the best I''ve had'),
  ('c0000000-0000-0000-0000-000000000015', 'https://youtube.com/watch?v=example8', 'Glass skin routine — every product I use'),
  ('c0000000-0000-0000-0000-000000000030', 'https://tiktok.com/@islapark/video/example9', 'Original choreography — 2M views'),
  ('c0000000-0000-0000-0000-000000000030', 'https://tiktok.com/@islapark/video/example10', 'Dance with @brand collab');

-- ============================================================
-- 7. Campaigns (3 open, 1 closed)
-- ============================================================

insert into public.campaigns (id, brand_id, title, description, offering_type, budget_min_cents, budget_max_cents, apply_by, status)
values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Summer Protein Launch', 'Looking for fitness creators to feature our new ProWhey Isolate flavor in a dedicated video. Show your workout, your shake routine, and give an honest take.', 'dedicated_video', 100000, 200000, (current_date + 30)::date, 'open'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Sustainable Style Challenge', 'Style our Linen Basics in 3 looks and post a short-form video. Show how sustainable fashion fits real life.', 'short_form_post', 50000, 100000, (current_date + 21)::date, 'open'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 'Clean Glow Serum Reviews', 'Beauty creators — try our Glow Serum for 2 weeks and share your honest results. Before/after content preferred.', 'dedicated_video', 80000, 180000, (current_date + 14)::date, 'open'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'Winter Gear Test', 'We need outdoor creators to test our TrailRunner Pro Jacket in cold conditions and film the experience.', 'dedicated_video', 120000, 220000, null, 'closed');

-- Campaign applications
insert into public.campaign_applications (campaign_id, creator_id, pitch, proposed_price_cents, status)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'I''ve been using protein supplements for 8 years — my audience trusts my reviews because I don''t sugarcoat. I''d show my real morning routine with ProWhey and give my honest verdict.', 180000, 'pending'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000025', 'I train calisthenics 6 days a week and nutrition is half the battle. I''d film a full training day showing how ProWhey fits into my prep and recovery.', 140000, 'pending'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000017', 'As a marathon runner, I rely heavily on protein for recovery. I''d film a race-week nutrition video featuring ProWhey as part of my real routine.', 160000, 'pending'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'Sustainable fashion is my whole thing! I''d style your Linen Basics with thrifted accessories to show how mixing new+vintage works for everyday.', 90000, 'pending'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000022', 'I''d love to showcase your pieces in a modest fashion context — three looks for three occasions: work, weekend, and evening.', 85000, 'pending'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007', 'I specialize in J-beauty routines and my audience loves seeing new products integrated into existing routines. I''d do a 2-week diary format.', 170000, 'pending'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000015', 'K-beauty meets clean beauty! I''d test your Glow Serum alongside my existing routine and share real before/after photos + video review.', 180000, 'pending'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000020', 'Natural skincare for melanin-rich skin is under-represented. I''d show how your serum works on my skin tone with honest, unfiltered results.', 150000, 'pending');

-- ============================================================
-- 8. Conversations (brands reaching out to creators)
--    Uses clipline.internal bypass so the trigger preserves
--    status values instead of forcing everything to 'invited'.
-- ============================================================

do $$
begin
  perform set_config('clipline.internal', '1', true);

  -- NovaStar reached out to a few fitness creators
  insert into public.conversations (id, brand_id, creator_id, status, invite_message, created_at, responded_at)
  values
    ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'accepted', 'Hey Jake! NovaStar here — we make premium sports nutrition and love your honest review style. Would you be interested in trying our new ProWhey Isolate and sharing your take?', now() - interval '5 days', now() - interval '4 days'),
    ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'accepted', 'Hey Liam! NovaStar Nutrition here. We think our HydraFuel electrolytes would be perfect for your outdoor adventures. Interested in a collab?', now() - interval '3 days', now() - interval '2 days'),
    ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000021', 'invited', 'Hey Ben! Your home gym content is awesome. We''d love to send you some ProWhey samples and talk about a potential video. What do you think?', now() - interval '1 day', null);

  -- Velvet & Vine reached out to fashion creators
  insert into public.conversations (id, brand_id, creator_id, status, invite_message, created_at, responded_at)
  values
    ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'accepted', 'Hi Sofia! We''re Velvet & Vine — your sustainable fashion content perfectly aligns with our brand. Would love to send you some pieces from our new Linen Basics line!', now() - interval '7 days', now() - interval '6 days'),
    ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000018', 'declined', 'Hey Yuki! Your Harajuku fashion content is incredible. We''d love to explore a collab featuring our sustainable accessories.', now() - interval '4 days', now() - interval '3 days');

  -- GreenLeaf reached out to beauty creators
  insert into public.conversations (id, brand_id, creator_id, status, invite_message, created_at, responded_at)
  values
    ('e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000007', 'accepted', 'Hi Aiko! GreenLeaf Co here — we make clean, organic skincare and your J-beauty expertise is exactly the voice we want. Would you be open to trying our Glow Serum?', now() - interval '6 days', now() - interval '5 days'),
    ('e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000015', 'accepted', 'Hi Olivia! Your K-beauty routines are amazing. We''d love to see how our Glow Serum fits into your regimen. Interested?', now() - interval '4 days', now() - interval '3 days');

  -- Luminary Studios reached out to tech creators
  insert into public.conversations (id, brand_id, creator_id, status, invite_message, created_at, responded_at)
  values
    ('e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'accepted', 'Hey Priya! Luminary Studios here — we built a new AI video editor and your tech reviews are exactly the honest deep-dives we respect. Want to try it out and share your take?', now() - interval '8 days', now() - interval '7 days');

  perform set_config('clipline.internal', '', true);
end;
$$;

-- ============================================================
-- 9. Messages in accepted conversations
-- ============================================================

insert into public.messages (conversation_id, sender_id, body, created_at)
values
  -- NovaStar + Jake
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Hey! Thanks for reaching out. I actually just ran out of my current protein so the timing is perfect. What flavors do you have?', now() - interval '4 days'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Nice timing! We have Vanilla Bean, Chocolate Peanut Butter, and our new Salted Caramel. I can send you all three if you want to do a comparison?', now() - interval '4 days' + interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'A comparison would actually make great content. My audience loves side-by-side reviews. Let me check my schedule — I could film next week.', now() - interval '3 days'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Perfect. I''ll ship them out today. For the video, we''re thinking a full honest review — no script needed. Just want your real opinion on taste, mixability, and how it fits your training.', now() - interval '3 days' + interval '1 hour'),

  -- NovaStar + Liam
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'Hey! Love your products. I''ve actually seen HydraFuel at my local outdoor shop. What kind of content are you looking for?', now() - interval '2 days'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'That''s great to hear! We''d love a trail run video where you use HydraFuel during the run. Something authentic — showing how it actually performs in real conditions.', now() - interval '2 days' + interval '3 hours'),

  -- Velvet & Vine + Sofia
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005', 'I love Velvet & Vine! I actually own your Everyday Tote already. Would love to work together.', now() - interval '6 days'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'That means so much! We''d love to send you the full Linen Basics collection. We''re thinking 3 outfit videos — casual, work, and going out. Sound good?', now() - interval '6 days' + interval '1 hour'),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005', 'That sounds perfect! I could also mix in some thrifted pieces to show how your line works with existing wardrobes. My audience responds really well to that kind of content.', now() - interval '5 days'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Love that idea — very on-brand for us. Let''s do it. I''ll send an offer for the 3-video package.', now() - interval '5 days' + interval '2 hours'),

  -- GreenLeaf + Aiko
  ('e0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000007', 'Hi! I''m really into clean beauty — it''s refreshing to see a brand that''s transparent about sourcing. I''d love to try the Glow Serum.', now() - interval '5 days'),
  ('e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000005', 'Your approach to J-beauty education is exactly what we admire. We''d love a routine video showing how Glow Serum integrates with your existing steps. We could also send you the Calm Balm if you''re interested.', now() - interval '5 days' + interval '4 hours'),

  -- Luminary + Priya
  ('e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Thanks for reaching out! An AI video editor sounds interesting. I''d want to really put it through its paces before reviewing though — at least a week of real use.', now() - interval '7 days'),
  ('e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'Absolutely — that''s exactly what we want. Real usage, real feedback. I''ll set you up with a Pro account. Take your time, and film whatever feels natural for your channel.', now() - interval '7 days' + interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Sounds good. I''ll plan for a full walkthrough video with my typical editing workflow as the demo. My audience loves seeing tools in real production scenarios, not just feature lists.', now() - interval '6 days');

-- ============================================================
-- 10. Offers + a couple of deals from conversations
-- ============================================================

-- Disable offer insert trigger for all seed offer inserts — seed runs as
-- postgres (no auth.uid()), but the trigger demands the brand's uid.
alter table public.offers disable trigger offers_validate_insert;

-- Velvet & Vine sent Sofia an offer (pending)
insert into public.offers (conversation_id, offering_id, price_cents, note, status)
values
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000008', 95000, 'Three TikTok styling videos featuring our Linen Basics. One casual, one work, one going out. Mix with your own pieces as discussed. Deliverables within 2 weeks.', 'pending');

-- GreenLeaf sent Aiko an offer (accepted → deal created)
-- We need to use service_role context to bypass triggers for this synthetic data
do $$
declare
  v_deal_id uuid := 'f0000000-0000-0000-0000-000000000001';
  v_offer_id uuid := gen_random_uuid();
begin
  -- Create the deal directly (bypass validate_deal_insert by using service_role insert context)
  perform set_config('clipline.internal', '1', true);

  insert into public.deals (id, brand_id, creator_id, offering_id, offering_type, offering_title, price_cents, currency, revision_limit, payment_mode, status, requested_at, accepted_at)
  values (v_deal_id, 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000011', 'dedicated_video', 'J-Beauty Routine Feature', 220000, 'usd', 2, 'off_platform', 'accepted', now() - interval '4 days', now() - interval '3 days');

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (v_deal_id, 'Full skincare routine video featuring Glow Serum as the hero product. Show your real evening routine, before/after skin texture.', 'Glow Serum: Vitamin C + hyaluronic acid serum, organic', 'Mention the transparent ingredient sourcing, show the texture and application, note it''s fragrance-free.');

  insert into public.deal_events (deal_id, actor, action, from_status, to_status)
  values
    (v_deal_id, 'c0000000-0000-0000-0000-000000000007', 'accept', 'requested', 'accepted');

  -- Mark the offer as accepted
  insert into public.offers (id, conversation_id, offering_id, price_cents, note, status, deal_id, decided_at)
  values (v_offer_id, 'e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000011', 220000, 'Full J-Beauty routine video with Glow Serum + Calm Balm. 2 weeks delivery.', 'accepted', v_deal_id, now() - interval '3 days');

  perform set_config('clipline.internal', '', true);
end;
$$;

-- Re-enable the offer insert trigger now that all seed offers are inserted
alter table public.offers enable trigger offers_validate_insert;

-- A storefront booking: NovaStar booked Jake's Honest Product Review
do $$
declare
  v_deal_id uuid := 'f0000000-0000-0000-0000-000000000002';
begin
  perform set_config('clipline.internal', '1', true);

  insert into public.deals (id, brand_id, creator_id, offering_id, offering_type, offering_title, price_cents, currency, revision_limit, payment_mode, status, requested_at)
  values (v_deal_id, 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'dedicated_video', 'Honest Product Review', 180000, 'usd', 2, 'off_platform', 'requested', now() - interval '2 days');

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (v_deal_id, 'Honest comparison review of all 3 ProWhey flavors. Show mixing, taste test, texture. Real training context.', 'ProWhey Isolate: Grass-fed whey protein isolate, 27g protein per scoop. HydraFuel Electrolytes: Zero-sugar electrolyte mix for intense training', 'Mention the grass-fed sourcing, compare to competitors you''ve tried, show mixability in a shaker.');

  insert into public.deal_events (deal_id, actor, action, from_status, to_status)
  values (v_deal_id, 'b0000000-0000-0000-0000-000000000001', 'book', null, 'requested');

  perform set_config('clipline.internal', '', true);
end;
$$;

-- A completed deal with review: PeakFit + Liam (from the closed Winter Gear campaign)
do $$
declare
  v_deal_id uuid := 'f0000000-0000-0000-0000-000000000003';
begin
  perform set_config('clipline.internal', '1', true);

  insert into public.deals (id, brand_id, creator_id, offering_id, offering_type, offering_title, price_cents, currency, revision_limit, payment_mode, status, requested_at, accepted_at, submitted_at, published_at, completed_at)
  values (v_deal_id, 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'dedicated_video', 'Trail Test Video', 200000, 'usd', 2, 'off_platform', 'completed', now() - interval '30 days', now() - interval '28 days', now() - interval '14 days', now() - interval '7 days', now() - interval '3 days');

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (v_deal_id, 'Film yourself using the TrailRunner Pro in actual cold/wet conditions. Show how it performs on a real trail run.', 'TrailRunner Pro Jacket: Ultralight waterproof running jacket', 'Highlight the weight, waterproofing, breathability. Be honest about any issues.');

  insert into public.deal_events (deal_id, actor, action, from_status, to_status)
  values
    (v_deal_id, 'c0000000-0000-0000-0000-000000000004', 'accept', 'requested', 'accepted'),
    (v_deal_id, 'c0000000-0000-0000-0000-000000000004', 'submit', 'in_production', 'submitted'),
    (v_deal_id, 'c0000000-0000-0000-0000-000000000004', 'publish', 'submitted', 'published'),
    (v_deal_id, 'b0000000-0000-0000-0000-000000000003', 'complete', 'published', 'completed');

  perform set_config('clipline.internal', '', true);
end;
$$;

-- Review on the completed deal
insert into public.reviews (deal_id, author_id, rating, body)
values
  ('f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 5, 'Liam delivered an incredible video. Authentic, well-shot, and his audience loved it. Would definitely work with him again.'),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 4, 'Great brand to work with — clear brief, fast communication, fair payment. The jacket is genuinely good too.');

-- ============================================================
-- 11. Notifications (a few recent ones)
-- ============================================================

insert into public.notifications (user_id, kind, title, body, href, created_at)
values
  ('c0000000-0000-0000-0000-000000000002', 'invite', 'NovaStar Nutrition wants to chat', 'Hey Jake! NovaStar here...', '/inbox/e0000000-0000-0000-0000-000000000001', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000001', 'invite_response', 'Jake Morrison accepted your invite', null, '/inbox/e0000000-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000001', 'message', 'New message', 'Hey! Thanks for reaching out...', '/inbox/e0000000-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000001', 'application', 'New application for Summer Protein Launch', 'Jake Morrison applied', '/campaigns/d0000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000001', 'application', 'New application for Summer Protein Launch', 'Omar Haddad applied', '/campaigns/d0000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000001', 'application', 'New application for Summer Protein Launch', 'Mia Thompson applied', '/campaigns/d0000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000005', 'invite', 'Velvet & Vine wants to chat', 'Hi Sofia! We''re Velvet & Vine...', '/inbox/e0000000-0000-0000-0000-000000000004', now() - interval '7 days'),
  ('c0000000-0000-0000-0000-000000000005', 'offer', 'You have an offer: $950.00', null, '/inbox/e0000000-0000-0000-0000-000000000004', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000007', 'invite', 'GreenLeaf Co wants to chat', 'Hi Aiko! GreenLeaf Co here...', '/inbox/e0000000-0000-0000-0000-000000000006', now() - interval '6 days'),
  ('b0000000-0000-0000-0000-000000000005', 'offer_response', 'Your offer was accepted — the deal has started', null, '/deals/f0000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000002', 'booking', 'New booking request: Honest Product Review', null, '/deals/f0000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000003', 'deal', 'Deal completed: Trail Test Video', null, '/deals/f0000000-0000-0000-0000-000000000003', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000004', 'deal', 'Deal completed: Trail Test Video', null, '/deals/f0000000-0000-0000-0000-000000000003', now() - interval '3 days');
