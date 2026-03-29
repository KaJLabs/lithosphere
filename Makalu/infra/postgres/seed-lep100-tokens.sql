-- ============================================================================
-- Seed 10 LEP100 Tokens into Lithosphere Explorer
-- Run this after init.sql to populate token list
-- ============================================================================

INSERT INTO contracts (address, name, symbol, decimals, total_supply, contract_type)
VALUES
  ('0xEB6cfcC84F35D6b20166cD6149Fed712ED2a7Cfe', 'Wrapped Lithosphere', 'wLITHO', 18, '1000000000000000000000000000', 'token'),
  ('0x468022F17CAFEBD43C18f68D53c66a1a7f0E5249', 'Lithosphere LitBTC', 'LitBTC', 8, '2100000000000000', 'token'),
  ('0x9611436ea7B4764Eeb1E31B83A5bF03c835Eb3e8', 'Lithosphere Algo', 'LAX', 6, '10000000000000000', 'token'),
  ('0x8187b232BDa461d17EA519Ba6898F7b220AAf2e2', 'Jot Art', 'JOT', 18, '1000000000000000000000000000', 'token'),
  ('0xE7eBf52bD714348984Fb00b4c99d9e994D60DF49', 'Colle AI', 'COLLE', 18, '5000000000000000000000000000', 'token'),
  ('0x7a29252B13367800dD78FED47afFaB86a615c844', 'Imagen Network', 'IMAGE', 18, '10000000000000000000000000000', 'token'),
  ('0x9984ad7a774218B263D74BD8A5FFEDa7DD6Fe020', 'AGII', 'AGII', 18, '1000000000000000000000000000', 'token'),
  ('0x07039884740F4DB0f71BD3bCF87a3FfA0B85A26F', 'Built AI', 'BLDR', 18, '1000000000000000000000000000', 'token'),
  ('0xa25c2a49893B0296977E2E70Da56AF47241d592F', 'FurGPT', 'FGPT', 18, '1000000000000000000000000000', 'token'),
  ('0xDEE12eD9C5A1F7c29f3ab3961B892a8434A97EFa', 'Mansa AI', 'MUSA', 18, '1000000000000000000000000000', 'token')
ON CONFLICT (address) DO NOTHING;

-- Verify insertion
SELECT COUNT(*) as token_count FROM contracts WHERE contract_type = 'token' AND symbol IN ('wLITHO', 'LitBTC', 'LAX', 'JOT', 'COLLE', 'IMAGE', 'AGII', 'BLDR', 'FGPT', 'MUSA');
