-- Add foreign key for winner_id in lot_results table
ALTER TABLE "lot_results" ADD CONSTRAINT "lot_results_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
