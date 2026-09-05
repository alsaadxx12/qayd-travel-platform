-- رقم مستند تسلسلي للكروب على المسافر: عمود إضافي بحت، يُخصَّص من تسلسل GRP.
ALTER TABLE group_passengers ADD COLUMN IF NOT EXISTS "docNumber" TEXT;
