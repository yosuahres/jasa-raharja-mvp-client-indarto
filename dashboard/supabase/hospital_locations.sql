-- Map pins for Peta Rumah Sakit. The dashboard's own lookup finds few hospitals by the names their
-- documents print, so without these the map lists them under "Lokasi belum ditemukan".
-- Run after migrations/013_location_source.sql, once the hospitals are in. Safe to run more than once.
--
-- 1. The sample hospitals get OpenStreetMap's coordinates:
--   RSUD Dr. Soedono Madiun          — Jl. Dokter Sutomo 59, Kartoharjo, Kota Madiun
--   Rumah Sakit Universitas Surabaya — Jl. Raya Panjang Jiwo Permai, Tenggilis Mejoyo, Surabaya
--   RSUD Dr. Iskak Tulungagung       — Jl. Dokter Wahidin Sudirohusodo, Kepatihan, Tulungagung
-- RS Ubaya's document prints no city, so it gets Surabaya too — the map's and Cari Rujukan's city lists
-- then include it.
--
-- 2. Every hospital in the database on 2026-10-30 gets its own pin, by id (see below).
--
-- Hospitals added later need nothing from here: when the lookup can't find one, the dashboard puts an
-- approximate pin on its town or city itself (lib/geocode.ts).
--
-- Pins found on OpenStreetMap are marked 'osm', which the lookup never touches. Dummy pins are marked
-- 'dummy' with no geocoded_query, so the dashboard tries them again and moves them to the hospital, or
-- at least its town, when it can. A pin someone placed on the hospital's page is never overwritten, and
-- a dummy row only lands where there is no pin yet or where this file put the same one before.

update public.hospitals
set city = case when city = '' then 'Surabaya' else city end,
    province = case when province = '' then 'Jawa Timur' else province end
where upper(name) like '%UBAYA%';

update public.hospitals as h
set lat = pin.lat,
    lng = pin.lng,
    location_source = 'osm',
    geocoded_query = concat_ws(', ', nullif(h.name, ''), nullif(h.address, ''), nullif(h.city, ''), nullif(h.province, '')),
    geocoded_at = now()
from (values
  ('%SOEDONO%', -7.6266935, 111.5245179),
  ('%UBAYA%',   -7.3141801, 112.7662757),
  ('%ISKAK%',   -8.0540317, 111.9181394)
) as pin (name_like, lat, lng)
where upper(h.name) like pin.name_like
  and h.location_source is distinct from 'manual';

-- 2. Every hospital in the database on 2026-10-30, one pin each by id: 152 found on OpenStreetMap (the comment
-- names the place it matched), 167 DUMMY pins near the centre of their kabupaten/kota, moved up to ~2 km so
-- they don't stack. A dummy row whose real place is known can become 'osm' with its coordinates, or be
-- placed on the hospital's page.
update public.hospitals as h
set lat = pin.lat,
    lng = pin.lng,
    location_source = pin.source,
    geocoded_query = case when pin.source = 'osm'
      then concat_ws(', ', nullif(h.name, ''), nullif(h.address, ''), nullif(h.city, ''), nullif(h.province, '')) end,
    geocoded_at = now()
from (values
  -- From OpenStreetMap, matched by name inside the hospital's own kabupaten/kota
  ('rs-adi-husada-kapasari-kota-surabaya', -7.2426596, 112.7518964, 'osm'),  -- OSM: Rumah Sakit Adi Husada Kapasan
  ('rs-aisyiyah-kab-bojonegoro', -7.1514375, 111.8784451, 'osm'),  -- OSM: Rumah Sakit Aisyiyah Bojonegoro
  ('rs-aisyiyah-kab-ponorogo', -7.8684367, 111.4717028, 'osm'),  -- OSM: IGD RSU Aisyiyah
  ('rs-aisyiyah-siti-fatimah-kab-sidoarjo', -7.4856479, 112.6526763, 'osm'),  -- OSM: Rumah Sakit Umum Aisyiyah Siti Fatimah
  ('rs-al-huda-genteng-kab-banyuwangi', -8.3765883, 114.1469734, 'osm'),  -- OSM: RS Al-Huda Genteng
  ('rs-al-irsyad-kota-surabaya', -7.2281430, 112.7411216, 'osm'),  -- OSM: Rumah Sakit Al Irsyad
  ('rs-al-islam-hm-mawardi-kab-sidoarjo', -7.4175051, 112.5837680, 'osm'),  -- OSM: Area Parkir Sakit Umum Al-Islam HM Mawardi
  ('rs-aminah-kota-blitar', -8.1149094, 112.1631995, 'osm'),  -- OSM: RSI Aminah Blitar
  ('rs-arafah-anwar-medika-kab-sidoarjo', -7.3940264, 112.6729840, 'osm'),  -- OSM: RSIA Arafah Anwar Medika Sukodono
  ('rs-arga-husada-kab-kediri', -7.9122692, 111.9830746, 'osm'),  -- OSM: RSU Arga Husada
  ('rs-assakinah-medika-kab-sidoarjo', -7.4143721, 112.6745462, 'osm'),  -- OSM: RS Assakinah Medika
  ('rs-aura-syifa-kab-kediri', -7.7977669, 112.0357651, 'osm'),  -- OSM: Rumah Sakit Aura Syifa
  ('rs-baptis-kota-kediri', -7.8267414, 112.0325291, 'osm'),  -- OSM: Rumah Sakit Baptis
  ('rs-baptis-batu-kota-batu', -7.9057237, 112.5378638, 'osm'),  -- OSM: RS Baptis Batu
  ('rs-bedah-hasta-husada-kab-malang', -8.1242660, 112.5659977, 'osm'),  -- OSM: RSKB Hasta Husada
  ('rs-bhakti-rahayu-kota-surabaya', -7.3121522, 112.7229351, 'osm'),  -- OSM: RSU Bhakti Rahayu
  ('rs-bhayangkara-kab-bondowoso', -7.9110607, 113.8223623, 'osm'),  -- OSM: RS Bhayangkara
  ('rs-bhayangkara-kab-lumajang', -8.1334096, 113.2217004, 'osm'),  -- OSM: RS Bhayangkara
  ('rs-bhayangkara-kota-kediri', -7.8133509, 112.0176884, 'osm'),  -- OSM: Rumah Sakit Bhayangkara
  ('rs-bhayangkara-kab-nganjuk', -7.5999776, 111.8947364, 'osm'),  -- OSM: RS. Bhayangkara
  ('rs-bhayangkara-kab-tulungagung', -8.0673832, 111.9077169, 'osm'),  -- OSM: RS. Bhayangkara
  ('rs-bhayangkara-hasta-brata-kota-batu', -7.8719839, 112.5240177, 'osm'),  -- OSM: RS Bhayangkara Hasta Brata
  ('rs-bhayangkara-pusdik-brimob-watukosek-kab-pasuruan', -7.5675848, 112.6595494, 'osm'),  -- OSM: RS. Bhayangkara Brimob Watukosek
  ('rs-bhayangkara-pusdik-porong-kab-sidoarjo', -7.5423087, 112.6986249, 'osm'),  -- OSM: RS. Bhayangkara Pusdik
  ('rs-bhayangkara-samsoeri-kota-surabaya', -7.3242814, 112.7299822, 'osm'),  -- OSM: Rumah Sakit Bhayangkara HS Samsoeri Mertojoso
  ('rs-bina-sehat-kab-jember', -8.1807654, 113.6844758, 'osm'),  -- OSM: RS Bina Sehat
  ('rs-bunda-kab-sidoarjo', -7.3516204, 112.7707124, 'osm'),  -- OSM: RS Bunda Sidoarjo
  ('rs-citra-husada-kab-jember', -8.1665940, 113.6800213, 'osm'),  -- OSM: RS Citra Husada
  ('rs-citra-medika-kab-sidoarjo', -7.4331082, 112.4635899, 'osm'),  -- OSM: RS. Citra Medika
  ('rs-daha-husada-kota-kediri', -7.8107595, 111.9976094, 'osm'),  -- OSM: RS Daha Husada
  ('rs-delta-surya-kab-sidoarjo', -7.4470451, 112.7014455, 'osm'),  -- OSM: Rumah Sakit Delta Surya
  ('rs-dhaha-husada-kota-kediri', -7.8107595, 111.9976094, 'osm'),  -- OSM: RS Daha Husada
  ('rs-dian-husada-kab-mojokerto', -7.5284388, 112.4100785, 'osm'),  -- OSM: Rumah Sakit Dian Husada
  ('rs-dr-etty-asharto-kota-batu', -7.8686197, 112.5116734, 'osm'),  -- OSM: RSU Dr. Etty Asharto
  ('rs-gigi-dan-mulut-iik-bhakti-wiyata-kota-kediri', -7.8163693, 112.0061354, 'osm'),  -- OSM: Rumah Sakit Gigi dan Mulut IIK Bhakta
  ('rs-gotong-royong-kota-surabaya', -7.3077957, 112.7875821, 'osm'),  -- OSM: Rumah Sakit Gotong Royong
  ('rs-graha-medika-kab-banyuwangi', -8.4033413, 114.1633796, 'osm'),  -- OSM: Rumah Sakit Graha Medika
  ('rs-graha-sehat-medika-kota-pasuruan', -7.6308527, 112.8797174, 'osm'),  -- OSM: RS Graha Sehat Medika
  ('rs-griya-husada-kota-madiun', -7.6530295, 111.5286330, 'osm'),  -- OSM: Rumah Sakit Griya Husada
  ('rs-haji-kota-surabaya', -7.2828102, 112.7798288, 'osm'),  -- OSM: RSUD Haji Provinsi Jawa Timur
  ('rs-hasanah-muhammadiyah-kota-mojokerto', -7.4684878, 112.4367845, 'osm'),  -- OSM: RSI Hasanah Muhammadiyah
  ('rs-hermina-kota-madiun', -7.6190570, 111.5022781, 'osm'),  -- OSM: RS Hermina Madiun
  ('rs-hermina-tangkubanprahu-kota-malang', -7.9780276, 112.6246040, 'osm'),  -- OSM: RS Hermina Tangkubanprahu
  ('rs-ibnu-sina-kab-bojonegoro', -7.1525460, 111.9013554, 'osm'),  -- OSM: RS. Ibnu Sina Bojonegoro
  ('rs-islam-aisyiyah-kota-malang', -7.9886220, 112.6254312, 'osm'),  -- OSM: RS Islam Aisyiah
  ('rs-islam-at-tin-husada-kab-ngawi', -7.4044207, 111.4148092, 'osm'),  -- OSM: RSI At-Tin Husada
  ('rs-islam-darus-syifa-kota-surabaya', -7.2354639, 112.6124816, 'osm'),  -- OSM: Rumah Sakit Islam Darus Syifa'
  ('rs-islam-jemursari-kota-surabaya', -7.3224337, 112.7396202, 'osm'),  -- OSM: Rumah Sakit Islam Jemursari Surabaya
  ('rs-islam-lumajang-kab-lumajang', -8.1340625, 113.2201275, 'osm'),  -- OSM: Rumah Sakit Islam Lumajang
  ('rs-islam-siti-aisyah-kota-madiun', -7.6327190, 111.5122024, 'osm'),  -- OSM: Rumah Sakit Islam Aisyah Madiun
  ('rs-islam-unisma-kota-malang', -7.9398503, 112.6094536, 'osm'),  -- OSM: RS Islam Unisma
  ('rs-jiwa-daerah-menur-kota-surabaya', -7.2858883, 112.7619771, 'osm'),  -- OSM: Rumah Sakit Jiwa Menur Provinsi Jawa Timur
  ('rs-kamar-medika-kota-mojokerto', -7.4645794, 112.4512250, 'osm'),  -- OSM: Kamar Medika
  ('rs-karsa-husada-d-h-paru-kota-batu', -7.8714497, 112.5227767, 'osm'),  -- OSM: RSUD Karsa Husada
  ('rs-katolik-budi-rahayu-kota-blitar', -8.0998161, 112.1721818, 'osm'),  -- OSM: RS Katolik Budi Rahayu
  ('rs-katolik-rkz-kota-surabaya', -7.2918896, 112.7354458, 'osm'),  -- OSM: Rumah Sakit Katolik St. Vincentius A Paulo (RKZ)
  ('rs-kristen-mojowarno-kab-jombang', -7.6354728, 112.3023972, 'osm'),  -- OSM: Rumah Sakit Kristen Mojowarno
  ('rs-larasati-kab-pamekasan', -7.1552897, 113.4819507, 'osm'),  -- OSM: Rumah Sakit Larasati
  ('rs-lavalette-kota-malang', -7.9654975, 112.6377176, 'osm'),  -- OSM: Rumah Sakit Lavalette
  ('rs-lirboyo-kota-kediri', -7.8168770, 111.9896735, 'osm'),  -- OSM: Rumah Sakit Umum Lirboyo
  ('rs-manyar-medical-centre-kota-surabaya', -7.2899995, 112.7635253, 'osm'),  -- OSM: RS Manyar Medical Centre
  ('rs-marsudi-waluyo-kab-malang', -7.9062501, 112.6560752, 'osm'),  -- OSM: RS Marsudi Waluyo
  ('rs-mayapada-hospital', -7.2919594, 112.7277010, 'osm'),  -- OSM: Mayapada Hospital
  ('rs-medika-mulia-kab-tuban', -6.9057831, 112.0582993, 'osm'),  -- OSM: RS Medika Mulia
  ('rs-medika-utama-kab-blitar', -8.1257595, 112.2072588, 'osm'),  -- OSM: RS Medika Utama
  ('rs-mitra-keluarga-kenjeran-kota-surabaya', -7.2513701, 112.7850606, 'osm'),  -- OSM: Rumah Sakit Mitra Keluarga Kenjeran
  ('rs-mitra-keluarga-sidoarjo-kab-sidoarjo', -7.4379688, 112.7136235, 'osm'),  -- OSM: RS Mitra Keluarga Sidoarjo
  ('rs-mitra-keluarga-waru-kab-sidoarjo', -7.3626793, 112.7285782, 'osm'),  -- OSM: Rumah Sakit Mitra Keluarga Waru
  ('rs-mitra-medika-kab-bondowoso', -7.9210394, 113.8323335, 'osm'),  -- OSM: Rumah Sakit Mitra Medika
  ('rs-mitra-sehat-kab-situbondo', -7.6986635, 114.0136369, 'osm'),  -- OSM: RS Mitra Sehat
  ('rs-muhammadiyah-kab-gresik', -7.1507261, 112.6551350, 'osm'),  -- OSM: RS Muhammadiyah Gresik Gedung 1
  ('rs-muhammadiyah-kab-lamongan', -7.1089196, 112.4041746, 'osm'),  -- OSM: RS Muhammadiyah Lamongan
  ('rs-muhammadiyah-a-dahlan-kota-kediri', -7.7889023, 112.0007395, 'osm'),  -- OSM: Rumah Sakit Muhammadiyah Ahmad Dahlan
  ('rs-muhammadiyah-sumberrejo-kab-bojonegoro', -7.1756882, 112.0044079, 'osm'),  -- OSM: RSI Muhammadiyah Sumberrejo
  ('rs-muslimat-kab-ponorogo', -7.8776521, 111.4698417, 'osm'),  -- OSM: Rumah Sakit Umum Muslimat Ponorogo
  ('rs-nahdlatul-ulama-diwek-kab-jombang', -7.5788183, 112.2370206, 'osm'),  -- OSM: RS NAHDLATUL ULAMA
  ('rs-orthopedi-traumatologi-kota-surabaya', -7.2994250, 112.6620760, 'osm'),  -- OSM: RS Orthopedi & Traumatologi
  ('rs-panti-nirmala-kota-malang', -7.9946398, 112.6340072, 'osm'),  -- OSM: Rumah Sakit Panti Nirmala
  ('rs-panti-waluya-sawahan-kota-malang', -7.9863577, 112.6248725, 'osm'),  -- OSM: RS Panti Waluya Sawahan
  ('rs-paru-dungus-kab-madiun', -7.6887200, 111.6172032, 'osm'),  -- OSM: RSUD Paru Dungus
  ('rs-persada-hospital-kota-malang', -7.9350725, 112.6505338, 'osm'),  -- OSM: Persada Hospital
  ('rs-petrokimia-kab-gresik', -7.1597576, 112.6431017, 'osm'),  -- OSM: Rumah Sakit Petrokimia Gresik
  ('rs-phc-primasatya-husada-citra-kota-surabaya', -7.2096224, 112.7357618, 'osm'),  -- OSM: Rumah Sakit PHC Surabaya
  ('rs-prima-medika-kab-tulungagung', -8.0679477, 111.8824332, 'osm'),  -- OSM: Rumah Sakit Prima Medika
  ('rs-punten-kota-batu', -7.8391538, 112.5310605, 'osm'),  -- OSM: RS Punten
  ('rs-putra-waspada-kab-tulungagung', -8.0258062, 111.9203578, 'osm'),  -- OSM: RS. Putra Waspada
  ('rs-ratih-kota-kediri', -7.8204878, 111.9982869, 'osm'),  -- OSM: Rumah Sakit Ratih
  ('rs-reksa-waluya-kota-mojokerto', -7.4777551, 112.4315612, 'osm'),  -- OSM: Rumah Sakit Rekso Waluyo
  ('rs-royal-kota-surabaya', -7.3289305, 112.7509362, 'osm'),  -- OSM: Rumah Sakit Royal Surabaya
  ('rs-sahabat-kab-pasuruan', -7.6880001, 112.7093968, 'osm'),  -- OSM: RS Sahabat
  ('rs-semen-gresik-kab-gresik', -7.1658965, 112.6423867, 'osm'),  -- OSM: Rumah Sakit Semen Gresik
  ('rs-siloam-jember-kab-jember', -8.1740895, 113.6873968, 'osm'),  -- OSM: Siloam Hospitals
  ('rs-siti-hajar-kab-sidoarjo', -7.4577459, 112.7218788, 'osm'),  -- OSM: Rumah Sakit Islam Siti Hajar
  ('rs-siti-khodijah-muhammadiyah-sepanjang-kab-sidoarjo', -7.3449378, 112.6989391, 'osm'),  -- OSM: Rumah Sakit Siti Khodijah Sepanjang
  ('rs-siti-miriam-lawang-kab-malang', -7.8482771, 112.6968577, 'osm'),  -- OSM: Rumah Sakit Siti Miriam
  ('rs-soepraoen-kota-malang', -7.9888885, 112.6204967, 'osm'),  -- OSM: RS Tentara Dr. Soepraoen
  ('rs-sumber-sentosa-tumpang-kab-malang', -8.0132369, 112.7566367, 'osm'),  -- OSM: Rumah Sakit Sumber Sentosa
  ('rs-syuhada-haji-kota-blitar', -8.0996100, 112.1477694, 'osm'),  -- OSM: RS Syuhada Haji Blitar
  ('rs-tni-al-dr-ramelan-kota-surabaya', -7.3083797, 112.7392133, 'osm'),  -- OSM: Lembaga Kesehatan Kelautan TNI AL RSTAL Dr. Ramelan
  ('rs-universitas-airlangga-kota-surabaya', -7.2697296, 112.7844513, 'osm'),  -- OSM: Rumah Sakit Universitas Airlangga
  ('rs-universitas-brawijaya-kota-malang', -7.9413452, 112.6215875, 'osm'),  -- OSM: RS Universitas Brawijaya
  ('rs-usada-kab-sidoarjo', -7.3705750, 112.7131758, 'osm'),  -- OSM: Rumah Sakit Usada
  ('rs-wava-husada-kab-malang', -8.1163119, 112.5744195, 'osm'),  -- OSM: RS Wava Husada
  ('rs-widodo-kab-ngawi', -7.4064189, 111.4445888, 'osm'),  -- OSM: RS. Widodo Ngawi
  ('rs-wijaya-kusuma-kab-lumajang', -8.1086870, 113.2310435, 'osm'),  -- OSM: RS Wijaya Kusuma
  ('rs-william-booth-kota-surabaya', -7.2911589, 112.7373234, 'osm'),  -- OSM: Rumah Sakit William Booth Surabaya
  ('rs-wiyung-sejahtera-kota-surabaya', -7.3112438, 112.6879207, 'osm'),  -- OSM: Rumah Sakit Wiyung Sejahtera
  ('rs-yasyfin-darussalam-gontor-kabupaten-ponorogo', -7.9251876, 111.4986475, 'osm'),  -- OSM: Rumah Sakit Yasyfin Darussalam Gontor
  ('rsud-asembagus-kab-situbondo', -7.7500275, 114.2343521, 'osm'),  -- OSM: RSUD asembagus
  ('rsud-balung-kab-jember', -8.2709605, 113.5394160, 'osm'),  -- OSM: RSUD Balung
  ('rsud-bangil-kab-pasuruan', -7.6054763, 112.8185589, 'osm'),  -- OSM: Rumah Sakit Umum Daerah Bangil
  ('rsud-besuki-kab-situbondo', -7.7362960, 113.6953697, 'osm'),  -- OSM: Rumah Sakit Besuki
  ('rsud-bhakti-dharma-husada-kota-surabaya', -7.2557965, 112.6358661, 'osm'),  -- OSM: RSUD Bhakti Dharma Husada
  ('rsud-blambangan-kab-banyuwangi', -8.2085805, 114.3658178, 'osm'),  -- OSM: RSUD Blambangan
  ('rsud-caruban-kab-madiun', -7.5392872, 111.6557944, 'osm'),  -- OSM: RSUD Caruban
  ('rsud-dolopo-kab-madiun', -7.7437840, 111.5301917, 'osm'),  -- OSM: RSUD Dolopo
  ('rsud-dr-h-koesnadi-kab-bondowoso', -7.9188451, 113.8142559, 'osm'),  -- OSM: RSUD Koesnadi
  ('rsud-dr-h-moh-anwar-kab-sumenep', -7.0156015, 113.8642230, 'osm'),  -- OSM: RSUD Dr. H. Moh. Anwar
  ('rsud-dr-harjono-s-kab-ponorogo', -7.8901845, 111.4601432, 'osm'),  -- OSM: RSUD Dr. Harjono Ponorogo
  ('rsud-dr-m-soewandhie-kota-surabaya', -7.2457701, 112.7580388, 'osm'),  -- OSM: RSUD Dr.M.Soewandhie
  ('rsud-dr-r-koesma-kab-tuban', -6.8984238, 112.0468622, 'osm'),  -- OSM: RSUD Dr. R. Koesma Tuban
  ('rsud-dr-r-soedarsono-kota-pasuruan', -7.6633115, 112.8990841, 'osm'),  -- OSM: RSUD dr. R. Soedarsono
  ('rsud-dr-r-sosodoro-kab-bojonegoro', -7.1601152, 111.8999913, 'osm'),  -- OSM: RSUD Dr. R. Sosodoro Djatikoesoemo
  ('rsud-dr-soebandi-kab-jember', -8.1516061, 113.7154055, 'osm'),  -- OSM: RUSD Dr. Soebandi Jember
  ('rsud-dr-soedomo-kab-trenggalek', -8.0591519, 111.7038008, 'osm'),  -- OSM: Rumah Sakit Dr. Soedomo
  ('rsud-dr-soegiri-kab-lamongan', -7.1151555, 112.4102310, 'osm'),  -- OSM: RSUD Dr. Soegiri
  ('rsud-dr-soeroto-kab-ngawi', -7.3924731, 111.4454129, 'osm'),  -- OSM: RS. Umum Daerah Dr. Soeroto
  ('rsud-dr-soetomo-kota-surabaya', -7.2680296, 112.7582191, 'osm'),  -- OSM: RSUD Dr. Soetomo
  ('rsud-dr-saiful-anwar-kota-malang', -7.9732675, 112.6320399, 'osm'),  -- OSM: RSUD dr. Saiful Anwar
  ('rsud-eka-candrarini', -7.3274017, 112.7838250, 'osm'),  -- OSM: RSUD Eka Candrarini
  ('rsud-gambiran-kota-kediri', -7.8394398, 112.0323630, 'osm'),  -- OSM: RSUD Gambiran
  ('rsud-geneng-ngawi', -7.4917719, 111.4294454, 'osm'),  -- OSM: Rumah Sakit Umum Daerah Geneng
  ('rsud-grati-kab-pasuruan', -7.7141641, 112.9986944, 'osm'),  -- OSM: RSUD Grati
  ('rsud-gresik-sehati-kab-gresik', -7.3243692, 112.5234446, 'osm'),  -- OSM: RSUD GRESIK SEHATI
  ('rsud-ibnu-sina-kab-gresik', -7.1687567, 112.6012283, 'osm'),  -- OSM: RSUD Ibnu Sina
  ('rsud-kab-jombang', -7.5500944, 112.2373322, 'osm'),  -- OSM: RSUD Jombang
  ('rsud-kab-sampang', -7.1967810, 113.2437681, 'osm'),  -- OSM: RSUD Sampang
  ('rsud-kanjuruhan-kepanjen-kab-malang', -8.1436701, 112.5699720, 'osm'),  -- OSM: RSUD Kanjuruhan Kepanjen Kab. Malang
  ('rsud-kertosono-kab-nganjuk', -7.6009050, 112.0942370, 'osm'),  -- OSM: RSUD Kerrtosono
  ('rsud-kilisuci-kota-kediri', -7.8175967, 112.0056630, 'osm'),  -- OSM: RSUD Kilisuci
  ('rsud-kota-madiun', -7.6121182, 111.5185227, 'osm'),  -- OSM: RSUD Kota Madiun
  ('rsud-kota-malang-kota-malang', -8.0268056, 112.6390915, 'osm'),  -- OSM: RSUD Kota Malang
  ('rsud-mardi-waluyo-kota-blitar', -8.1095353, 112.1798660, 'osm'),  -- OSM: RSUD Mardi Waluyo
  ('rsud-ngimbang-kab-lamongan', -7.2889936, 112.2154345, 'osm'),  -- OSM: RSUD Ngimbang
  ('rsud-ngudi-waluyo-kab-blitar', -8.0833232, 112.3156077, 'osm'),  -- OSM: RSUD Ngudi Waluyo
  ('rsud-padangan-kab-bojonegoro', -7.1675235, 111.6092052, 'osm'),  -- OSM: Rumah Sakit Umum Daerah Padangan
  ('rsud-r-t-notopuro-kab-sidoarjo', -7.4653252, 112.7156168, 'osm'),  -- OSM: Rumah Sakit Umum Daerah Raden Tumenggung Notopuro
  ('rsud-sidoarjo-barat-kab-sidoarjo', -7.4060301, 112.5852186, 'osm'),  -- OSM: RSUD Sidoarjo Barat
  ('rsud-simpang-lima-gumul-kab-kediri', -7.8212353, 112.0579590, 'osm'),  -- OSM: RSUD Simpang Lima Gumul
  ('rsud-srengat-kab-blitar', -8.0647260, 112.0803271, 'osm'),  -- OSM: RSUD Srengat Kabupaten Blitar
  ('rumah-sakit-baghraf-health-care', -7.0158404, 113.8454822, 'osm'),  -- OSM: BHC Baghraf Health Care
  ('rumah-sakit-umum-daerah-dungus-kab-madiun', -7.6887200, 111.6172032, 'osm'),  -- OSM: RSUD Paru Dungus
  -- DUMMY: not on OpenStreetMap (or only under another hospital's name); near the centre of its kabupaten/kota
  ('bambang-shita-hospital-kota-malang', -7.9748353, 112.6508745, 'dummy'),  -- dummy: near Kota Malang
  ('klinik-aura-syifa-2-kab-kediri', -7.8576471, 112.0134863, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('klinik-nafira-kertosono-kab-nganjuk', -7.5937275, 111.8929118, 'dummy'),  -- dummy: near Kabupaten Nganjuk
  ('klinik-utama-panasea-medika-caruban-kab-madiun', -7.6498000, 111.5079784, 'dummy'),  -- dummy: near Kabupaten Madiun
  ('klinik-utama-rawat-inap-yepa-husada-kaibon-kota-madiun', -7.6129373, 111.5343314, 'dummy'),  -- dummy: near Kota Madiun
  ('rs-airlangga-kab-jombang', -7.5319608, 112.2486078, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-al-aziz-kab-jombang', -7.5485882, 112.2177059, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-al-ittihad-kab-blitar', -8.0943235, 112.1575275, 'dummy'),  -- dummy: near Kabupaten Blitar
  ('rs-al-rohmah-jajag-kab-banyuwangi', -8.2356490, 114.3530216, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rs-aminah-kab-sidoarjo', -7.4561922, 112.7202608, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-an-nisaa-kab-blitar', -8.0980882, 112.1696059, 'dummy'),  -- dummy: near Kabupaten Blitar
  ('rs-ananda-kab-blitar', -8.0874216, 112.1460765, 'dummy'),  -- dummy: near Kabupaten Blitar
  ('rs-anna-medika-madura-kab-bangkalan', -7.0589118, 112.7301588, 'dummy'),  -- dummy: near Kabupaten Bangkalan
  ('rs-anwar-medika-kab-sidoarjo', -7.4571333, 112.7061431, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-asih-abyakta-kab-pasuruan', -7.6254569, 112.9119706, 'dummy'),  -- dummy: near Kabupaten Pasuruan
  ('rs-au-dr-munir-lanud-abd-rachman-saleh-kab-malang', -7.9818941, 112.6353451, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-aulia-kab-blitar', -8.0780098, 112.1463902, 'dummy'),  -- dummy: near Kabupaten Blitar
  ('rs-bakti-mulia-kab-banyuwangi', -8.2345510, 114.3658843, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rs-bala-keselamatan-bokor-kab-malang', -7.9495804, 112.6198157, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-bedah-mitra-sehat-kab-lamongan', -7.1302686, 112.4039157, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-ben-mari-kab-malang', -7.9513059, 112.6295412, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-bhayangkara-wahyu-tutuko-kab-bojonegoro', -7.1637686, 111.9002882, 'dummy'),  -- dummy: near Kabupaten Bojonegoro
  ('rs-darmayu-kab-ponorogo', -7.8493353, 111.4808157, 'dummy'),  -- dummy: near Kabupaten Ponorogo
  ('rs-dharma-husada-kota-probolinggo', -7.7473196, 113.2018608, 'dummy'),  -- dummy: near Kota Probolinggo
  ('rs-dharma-husada-kab-mojokerto', -7.4636510, 112.4269765, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-djatiroto-kab-lumajang', -8.1373431, 113.2416627, 'dummy'),  -- dummy: near Kabupaten Lumajang
  ('rs-dkt-baladhika-husada-kab-jember', -8.1715373, 113.6930196, 'dummy'),  -- dummy: near Kabupaten Jember
  ('rs-dkt-tni-ad-tk-iv-kota-kediri', -7.8425882, 112.0180353, 'dummy'),  -- dummy: near Kota Kediri
  ('rs-dr-moedjito-dwidjosiswojo-kab-jombang', -7.5338431, 112.2357451, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-dr-suyudi-paciran-kab-lamongan', -7.1341902, 112.4181902, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-eka-husada-kab-gresik', -7.1489922, 112.6707941, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-emma-kota-mojokerto', -7.4755725, 112.4299569, 'dummy'),  -- dummy: near Kota Mojokerto
  ('rs-era-medika-kab-tulungagung', -8.0809941, 111.9052451, 'dummy'),  -- dummy: near Kabupaten Tulungagung
  ('rs-fathma-medika-kab-gresik', -7.1588745, 112.6527549, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-graha-husada-kab-tuban', -6.9009725, 112.0786255, 'dummy'),  -- dummy: near Kabupaten Tuban
  ('rs-graha-sehat-kab-probolinggo', -7.7540647, 113.2315078, 'dummy'),  -- dummy: near Kabupaten Probolinggo
  ('rs-hasyim-asyari-kab-jombang', -7.5612941, 112.2512745, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-hermina-pasuruan', -7.6397314, 112.9195000, 'dummy'),  -- dummy: near Kabupaten Pasuruan
  ('rs-husada-utama-kota-surabaya', -7.2472255, 112.7430804, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-hva-ptp-xxi-toeloengredjo-kab-kediri', -7.8477647, 112.0053294, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('rs-intan-medika-kab-lamongan', -7.1133275, 112.4191314, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-islam-a-yani-kota-surabaya', -7.2710686, 112.7324137, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-islam-aisyiyah-kab-nganjuk', -7.5976490, 111.9062451, 'dummy'),  -- dummy: near Kabupaten Nganjuk
  ('rs-islam-aminah-sananwetan-kota-blitar', -8.0816176, 112.1419980, 'dummy'),  -- dummy: near Kota Blitar
  ('rs-islam-arofah-kab-mojokerto', -7.4727490, 112.4345059, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-islam-cahaya-giri-kab-gresik', -7.1678157, 112.6452255, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-islam-fatimah-kab-banyuwangi', -8.2198059, 114.3682373, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rs-islam-garam-kalianget-kab-sumenep', -7.0186608, 113.8733667, 'dummy'),  -- dummy: near Kabupaten Sumenep
  ('rs-islam-gondang-legi-kab-malang', -7.9702863, 112.6500902, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-islam-jombang-kab-jombang', -7.5638039, 112.2202157, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-islam-mabarrot-mwc-nu-kab-gresik', -7.1588745, 112.6711078, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-islam-madinah-kab-tulungagung', -8.0637392, 111.9021078, 'dummy'),  -- dummy: near Kabupaten Tulungagung
  ('rs-islam-madinah-kasembon-kab-malang', -7.9530314, 112.6154235, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-islam-masyithoh-bangil-kab-pasuruan', -7.6257706, 112.9268725, 'dummy'),  -- dummy: near Kabupaten Pasuruan
  ('rs-islam-nashrul-ummah-kab-lamongan', -7.1283863, 112.4097196, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-islam-orpeha-kab-tulungagung', -8.0640529, 111.8889314, 'dummy'),  -- dummy: near Kabupaten Tulungagung
  ('rs-islam-sakinah-kab-mojokerto', -7.4644353, 112.4326235, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-kartini-kab-mojokerto', -7.4826314, 112.4200745, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-kh-abdurrahman-syamsuri-asyr-kab-lamongan', -7.1051706, 112.4241510, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-kusuma-hospital-kab-pamekasan', -7.1694275, 113.4547569, 'dummy'),  -- dummy: near Kabupaten Pamekasan
  ('rs-lawang-medika-kab-malang', -7.9530314, 112.6348745, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-marinir-ewa-pangalilla-gng-sari-kota-surabaya', -7.2412647, 112.7466882, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-mawaddah-medika-kab-mojokerto', -7.4539255, 112.4260353, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-mitra-delima-kab-malang', -7.9786000, 112.6130706, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-mitra-keluarga-kota-surabaya', -7.2687157, 112.7396294, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-mitra-keluarga-pondok-tjandra-kab-sidoarjo', -7.4676431, 112.6989275, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-mitra-sehat-mandiri-kab-sidoarjo', -7.4458392, 112.7332804, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-mitra-sehat-medika-kab-pasuruan', -7.6387902, 112.9191863, 'dummy'),  -- dummy: near Kabupaten Pasuruan
  ('rs-muhammadiyah-kab-lumajang', -8.1269902, 113.2123294, 'dummy'),  -- dummy: near Kabupaten Lumajang
  ('rs-muhammadiyah-kab-jombang', -7.5275686, 112.2423333, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-muhammadiyah-kab-tuban', -6.9053647, 112.0758020, 'dummy'),  -- dummy: near Kabupaten Tuban
  ('rs-muhammadiyah-kab-ponorogo', -7.8698843, 111.4839529, 'dummy'),  -- dummy: near Kabupaten Ponorogo
  ('rs-muhammadiyah-babat-kab-lamongan', -7.1365431, 112.4068961, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-muhammadiyah-bandung-kab-tulungagung', -8.0678176, 111.8854804, 'dummy'),  -- dummy: near Kabupaten Tulungagung
  ('rs-muhammadiyah-kalikapas-kab-lamongan', -7.0973275, 112.4357588, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-muhammadiyah-kalitidu-kab-bojonegoro', -7.1501216, 111.8651510, 'dummy'),  -- dummy: near Kabupaten Bojonegoro
  ('rs-muhammadiyah-rogojampi-kab-banyuwangi', -8.2348647, 114.3749824, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rs-muhammadiyah-sekapuk-kab-gresik', -7.1515020, 112.6667157, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-muhammadiyah-siti-khodijah-kab-kediri', -7.8414902, 112.0365451, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('rs-muhammadiyah-surya-melati-kab-kediri', -7.8607843, 112.0247804, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('rs-muna-anggita-kab-bojonegoro', -7.1360039, 111.8822490, 'dummy'),  -- dummy: near Kabupaten Bojonegoro
  ('rs-mutiara-hati-kab-mojokerto', -7.4887490, 112.4153686, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-nahdlatul-ulama-kab-banyuwangi', -8.2345510, 114.3787471, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rs-nahdlatul-ulama-kab-tuban', -6.8823059, 112.0693706, 'dummy'),  -- dummy: near Kabupaten Tuban
  ('rs-nahdlatul-ulama-babat-kab-lamongan', -7.1098765, 112.4068961, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-paru-manguharjo-kota-madiun', -7.6113686, 111.5189588, 'dummy'),  -- dummy: near Kota Madiun
  ('rs-pelengkap-medical-center-kab-jombang', -7.5623922, 112.2329216, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-perkebunan-ptpn-x-kab-jember', -8.1694980, 113.6909804, 'dummy'),  -- dummy: near Kabupaten Jember
  ('rs-permata-hati-kab-lamongan', -7.1054843, 112.4222686, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rs-petrokimia-driyorejo-kab-gresik', -7.1707961, 112.6676569, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-pindad-kab-malang', -7.9607176, 112.6212275, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-pku-muhammadiyah-mojoagung-kab-jombang', -7.5484314, 112.2236667, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-prasetya-husada-kab-malang', -7.9613451, 112.6281294, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-premiere-internasional-kota-surabaya', -7.2596176, 112.7410412, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-prima-husada-kab-malang', -7.9654235, 112.6348745, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-prima-husada-sukorejo-kab-pasuruan', -7.6554176, 112.9166765, 'dummy'),  -- dummy: near Kabupaten Pasuruan
  ('rs-ptp-xxi-xxii-gatoel-kota-mojokerto', -7.4848275, 112.4161529, 'dummy'),  -- dummy: near Kota Mojokerto
  ('rs-ptpn-xi-elizabeth-kab-situbondo', -7.7248314, 114.0135569, 'dummy'),  -- dummy: near Kabupaten Situbondo
  ('rs-ptpn-xii-bhakti-husada-krikilan-kab-banyuwangi', -8.2031784, 114.3845510, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rs-ptpn-xii-kaliwates-kab-jember', -8.1676157, 113.7118431, 'dummy'),  -- dummy: near Kabupaten Jember
  ('rs-pusura-candi-kab-sidoarjo', -7.4378392, 112.7066137, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-rahman-rahim-kab-sidoarjo', -7.4422314, 112.7315549, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-randegansari-husada-kab-gresik', -7.1478941, 112.6373824, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-rizani-paiton-kab-probolinggo', -7.7557902, 113.2034294, 'dummy'),  -- dummy: near Kabupaten Probolinggo
  ('rs-santa-clara-kota-madiun', -7.6474471, 111.5186451, 'dummy'),  -- dummy: near Kota Madiun
  ('rs-satiti-prima-husada-kab-tulungagung', -8.0518176, 111.8908137, 'dummy'),  -- dummy: near Kabupaten Tulungagung
  ('rs-sheila-medika-kab-sidoarjo', -7.4602706, 112.7292020, 'dummy'),  -- dummy: near Kabupaten Sidoarjo
  ('rs-sido-waras-kab-mojokerto', -7.4696118, 112.4421922, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-sumberglagah-kab-mojokerto', -7.4666314, 112.4437608, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rs-sumekar-kab-sumenep', -7.0164647, 113.8647392, 'dummy'),  -- dummy: near Kabupaten Sumenep
  ('rs-surabaya-medical-service-sms-kota-surabaya', -7.2580490, 112.7405706, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-surya-medika-kab-gresik', -7.1511882, 112.6466373, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-tni-ad-tk-iii-brawijaya-kota-surabaya', -7.2735784, 112.7479431, 'dummy'),  -- dummy: near Kota Surabaya
  ('rs-tni-au-lanud-iswahyudi-d-h-dr-efram-kab-magetan', -7.6457706, 111.3475902, 'dummy'),  -- dummy: near Kabupaten Magetan
  ('rs-tuberkulosa-paru-kab-jember', -8.1605569, 113.7071373, 'dummy'),  -- dummy: near Kabupaten Jember
  ('rs-unipdu-medika-kab-jombang', -7.5542353, 112.2504902, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rs-univ-muhammadiyah-kab-malang', -7.9756196, 112.6508745, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-universitas-muhammadiyah-jember-kab-jember', -8.1713804, 113.6939608, 'dummy'),  -- dummy: near Kabupaten Jember
  ('rs-wajak-husada-kab-malang', -7.9668353, 112.6133843, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rs-wali-songo-1-kab-gresik', -7.1667176, 112.6510294, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-wates-husada-kab-gresik', -7.1766000, 112.6593431, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rs-wava-husada-kesamben-d-h-budi-mulyo-kab-blitar', -8.0769118, 112.1658412, 'dummy'),  -- dummy: near Kabupaten Blitar
  ('rs-wilujeng-kab-kediri', -7.8300392, 112.0131725, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('rs-wonolangan-kab-probolinggo', -7.7697510, 113.2225667, 'dummy'),  -- dummy: near Kabupaten Probolinggo
  ('rs-yasmin-kab-banyuwangi', -8.2209039, 114.3519235, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rsi-nyai-ageng-pinatih-kab-gresik', -7.1455412, 112.6375392, 'dummy'),  -- dummy: near Kabupaten Gresik
  ('rsia-agung-mulia-kab-pacitan', -8.1911176, 111.0907255, 'dummy'),  -- dummy: near Kabupaten Pacitan
  ('rsia-rahayu-medika-kab-banyuwangi', -8.2177667, 114.3821980, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rsu-amanah', -7.2422059, 112.7377471, 'dummy'),  -- dummy: near Surabaya (no city)
  ('rsu-darmayu-madiun', -7.6228196, 111.5260176, 'dummy'),  -- dummy: near Kabupaten Madiun
  ('rsu-muhammadiyah-babat-kab-lamongan', -7.1094059, 112.4098765, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rsud-ar-rozy-kota-probolinggo', -7.7675549, 113.1971549, 'dummy'),  -- dummy: near Kota Probolinggo
  ('rsud-campurdarat-kab-tulungagung', -8.0518176, 111.8879902, 'dummy'),  -- dummy: near Kabupaten Tulungagung
  ('rsud-dr-abdoer-rahem-kab-situbondo', -7.6958118, 114.0121451, 'dummy'),  -- dummy: near Kabupaten Situbondo
  ('rsud-dr-h-slamet-m-kab-pamekasan', -7.1681725, 113.4610314, 'dummy'),  -- dummy: near Kabupaten Pamekasan
  ('rsud-dr-haryoto-kab-lumajang', -8.1481667, 113.2266039, 'dummy'),  -- dummy: near Kabupaten Lumajang
  ('rsud-dr-moh-saleh-kota-probolinggo', -7.7535941, 113.2203706, 'dummy'),  -- dummy: near Kota Probolinggo
  ('rsud-dr-sayidiman-kab-magetan', -7.6515745, 111.3246882, 'dummy'),  -- dummy: near Kabupaten Magetan
  ('rsud-dr-wahidin-s-husodo-kota-mojokerto', -7.4628667, 112.4307412, 'dummy'),  -- dummy: near Kota Mojokerto
  ('rsud-dr-darsono-kab-pacitan', -8.1917451, 111.0773922, 'dummy'),  -- dummy: near Kabupaten Pacitan
  ('rsud-genteng-kab-banyuwangi', -8.2191784, 114.3831392, 'dummy'),  -- dummy: near Kabupaten Banyuwangi
  ('rsud-husada-prima', -7.2387549, 112.7524922, 'dummy'),  -- dummy: near Kota Surabaya
  ('rsud-kab-nganjuk', -7.5946686, 111.9139314, 'dummy'),  -- dummy: near Kabupaten Nganjuk
  ('rsud-kabupaten-kediri', -7.8541961, 112.0315255, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('rsud-kalisat-kab-jember', -8.1638510, 113.7054118, 'dummy'),  -- dummy: near Kabupaten Jember
  ('rsud-karangkembang-babat-kab-lamongan', -7.1109745, 112.4105039, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rsud-kepohbaru-kab-bojonegoro', -7.1656510, 111.8835039, 'dummy'),  -- dummy: near Kabupaten Bojonegoro
  ('rsud-ketapang-kab-sampang', -7.1974176, 113.2522137, 'dummy'),  -- dummy: near Kabupaten Sampang
  ('rsud-ki-ageng-brondong', -7.1137980, 112.4211706, 'dummy'),  -- dummy: near Kabupaten Lamongan
  ('rsud-lawang-kab-malang', -7.9531882, 112.6204431, 'dummy'),  -- dummy: near Kabupaten Malang
  ('rsud-mantingan-ngawi', -7.4142745, 111.4499294, 'dummy'),  -- dummy: near Kabupaten Ngawi
  ('rsud-mohammad-noer-kab-pamekasan', -7.1736627, 113.4867569, 'dummy'),  -- dummy: near Kabupaten Pamekasan
  ('rsud-panti-waluyo-caruban-kab-madiun', -7.6256431, 111.5209980, 'dummy'),  -- dummy: near Kabupaten Madiun
  ('rsud-pare-kab-kediri', -7.8604706, 112.0054863, 'dummy'),  -- dummy: near Kabupaten Kediri
  ('rsud-pasirian-kab-lumajang', -8.1342059, 113.2106039, 'dummy'),  -- dummy: near Kabupaten Lumajang
  ('rsud-ploso-kab-jombang', -7.5539216, 112.2239804, 'dummy'),  -- dummy: near Kabupaten Jombang
  ('rsud-prof-dr-soekandar-kab-mojokerto', -7.4587882, 112.4373294, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rsud-r-ali-manshur-jatirogo-kab-tuban', -6.8983059, 112.0805078, 'dummy'),  -- dummy: near Kabupaten Tuban
  ('rsud-ra-basoeni-kab-mojokerto', -7.4730627, 112.4530157, 'dummy'),  -- dummy: near Kabupaten Mojokerto
  ('rsud-sumberrejo-kab-bojonegoro', -7.1394549, 111.8828765, 'dummy'),  -- dummy: near Kabupaten Bojonegoro
  ('rsud-syarifah-ambarni-re-kab-bangkalan', -7.0386765, 112.7461588, 'dummy'),  -- dummy: near Kabupaten Bangkalan
  ('rsud-tongas-kab-probolinggo', -7.7379078, 113.2257039, 'dummy'),  -- dummy: near Kabupaten Probolinggo
  ('rsud-waluyo-jati-kab-probolinggo', -7.7402608, 113.1977824, 'dummy'),  -- dummy: near Kabupaten Probolinggo
  ('rsud-waru-pamekasan-kab-pamekasan', -7.1535843, 113.4823647, 'dummy'),  -- dummy: near Kabupaten Pamekasan
  ('rumah-sakit-cahaya-medika', -7.2715392, 112.7399431, 'dummy'),  -- dummy: near Surabaya (no city)
  ('rumah-sakit-dika-husada-kab-pasuruan', -7.6447510, 112.8920490, 'dummy'),  -- dummy: near Kabupaten Pasuruan
  ('rumah-sakit-umum-pusat-surabaya', -7.2379706, 112.7631588, 'dummy')   -- dummy: near Kota Surabaya
) as pin (id, lat, lng, source)
where h.id = pin.id
  and h.location_source is distinct from 'manual'
  -- A dummy only where nothing better is known: no pin yet, or the same dummy from an earlier run.
  and (pin.source = 'osm' or h.lat is null or (h.lat = pin.lat and h.lng = pin.lng));

-- What the map now shows: every hospital with its pin and where the pin came from.
select name, city, location_source, round(lat::numeric, 5) as lat, round(lng::numeric, 5) as lng
from public.hospitals
order by city, name;
