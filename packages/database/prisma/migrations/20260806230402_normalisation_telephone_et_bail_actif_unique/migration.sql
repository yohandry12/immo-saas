-- Backfill : normalise les téléphones déjà en base au même format que
-- normalizePhone() côté application (« +237699000001 ») :
--   - on ne garde que les chiffres ;
--   - préfixe 237 déjà là → « + » devant ;
--   - 9 chiffres (numéro local camerounais) → « +237 » devant ;
--   - sinon → « + » devant.
UPDATE "Lease"
SET "tenantPhone" =
  CASE
    WHEN regexp_replace("tenantPhone", '\D', '', 'g') LIKE '237%'
      THEN '+' || regexp_replace("tenantPhone", '\D', '', 'g')
    WHEN length(regexp_replace("tenantPhone", '\D', '', 'g')) = 9
      THEN '+237' || regexp_replace("tenantPhone", '\D', '', 'g')
    ELSE '+' || regexp_replace("tenantPhone", '\D', '', 'g')
  END
WHERE "tenantPhone" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Lease_tenantPhone_idx" ON "Lease"("tenantPhone");

-- Un seul bail ACTIF (endDate NULL) par appartement.
-- Index unique PARTIEL : introuvable dans le langage Prisma, d'où ce SQL
-- manuel. La règle du service devient une garantie PostgreSQL — même une
-- course entre deux requêtes simultanées ne peut plus créer deux baux actifs.
CREATE UNIQUE INDEX "Lease_one_active_per_unit"
ON "Lease"("unitId")
WHERE "endDate" IS NULL;
