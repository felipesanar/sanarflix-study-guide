delete from public.ies_features
 where feature_key in ('home','studyGuide','dashboard','simulados','SimuladoDesempenho','sanarclass','errorNotebook','desempenhoInstitucional','analytics','cronogramaEnamed','enamed','intensivoUSCS');

drop function if exists public.get_ies_features(uuid);
drop function if exists public.ies_has_feature(uuid, text);
drop function if exists public.get_institutional_longitudinal_tri(uuid);
drop function if exists public.get_institutional_question_details(uuid, text, text, text, uuid);
drop function if exists public.schedule_flashcard_review_guarded(uuid, text);