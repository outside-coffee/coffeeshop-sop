-- CAPUCCIN is an active alias of the canonical CAPUCIN product.
-- Keep the duplicate recipe rows for audit history, but exclude them from use.
update public.composition_produit
set actif = false
where upper(trim(nom_produit)) = 'CAPUCCIN'
  and actif is true;
