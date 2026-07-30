-- BioForge seed data — curated *starting reference* mapping of common plastics
-- to known / candidate degrading enzyme families.
--
-- IMPORTANT: This is reference/starting data for the MVP, NOT authoritative.
-- Reference sequences are representative starting points — verify each against
-- the cited UniProt accession before using in real analysis. PET-degrading
-- families are well established in the literature; PU and especially PE/PP
-- candidates are EMERGING / less established and flagged as such.
--
-- Idempotent: safe to re-run. Uses on conflict to avoid duplicate rows.

-- ---------------------------------------------------------------------------
-- plastics
-- ---------------------------------------------------------------------------
insert into public.plastics (name, common_name, notes) values
  ('PET', 'Polyethylene terephthalate',
   'Most tractable target. Enzymatic hydrolysis of the ester backbone is well established (PETase/cutinase). Semi-crystalline; amorphous regions degrade faster.'),
  ('PU',  'Polyurethane',
   'Heterogeneous ester/urethane linkages. Esterase/urease routes are documented but less mature than PET. Formulation-dependent.'),
  ('PE',  'Polyethylene',
   'Pure C-C backbone, no hydrolysable bonds. Only EMERGING oxidative candidates (laccase / MnP). Highly speculative — flagged as less established.'),
  ('PP',  'Polypropylene',
   'Like PE, an inert C-C backbone. Oxidative enzyme candidates are EMERGING and unproven at scale. Flagged as less established.')
on conflict (name) do update
  set common_name = excluded.common_name,
      notes       = excluded.notes;

-- ---------------------------------------------------------------------------
-- enzyme_families
-- ---------------------------------------------------------------------------

-- PET (well established) -----------------------------------------------------
insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'PETase',
  'MQTNPYARGPNPTAASLEASAGPFTVRSFTVSRPSGYGAGTVYYPTNAGGTVGAIAIVPGYTARQSSIKWWGPRLASHGFVVITIDTNSTLDQPSSRSSQQMAALRQVASLNGTSSSPIYGKVDTARMGVMGWSMGGGGSLISAANNPSLKAAAPQAPWDSSTNFSSVTVPTLIFACENDSIAPVNSSALPIYDSMSRNAKQFLEINGGSHSCANSGNSNQALIGKKGVAWMKRFMDNDTRYSTFACENPNSTRVSDFRTANCS',
  'Ideonella sakaiensis PETase (IsPETase): α/β-hydrolase with a Ser-His-Asp catalytic triad that hydrolyses the PET ester backbone to MHET. Well established as the canonical PET-degrading enzyme.',
  'Starting reference — verify against UniProt A0A0K8P6T7 (Yoshida et al., Science 2016).'
from public.plastics p where p.name = 'PET'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;

insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'MHETase',
  'MQTTVTTMLLASVALAACAGGGSTPLPAPTPTSAPTLPTGSGGYEEGVAKAAPAGWSSLDGKWQSVLGRDLYTPTGTATLAGKTVTLPSGSVKELRIYVPKGSGPFPGVVMIHGGGWKSGSPAQFRPMCEALASRGYVTLSIDYRLSGEAKFPAQIHDCKAAVRWLRANAADYGIDPARIGVWGWSAGGHLSLMAAYTQGDNAPYAPVSHRPDAVVLGAPVIDLTAAYADTPESSRAAMLGGTLDENPDLYAEASPINHVSAGTPPTLLIHGDADRTVPVAQSEQLAAALKAAGVPVELHIVPGAGHGFFNRSAQVEAAALSFLDRHLK',
  'Ideonella sakaiensis MHETase: hydrolyses mono-(2-hydroxyethyl) terephthalate (MHET), the PETase product, into terephthalic acid + ethylene glycol. Completes PET depolymerisation; works synergistically with PETase.',
  'Starting reference — verify against UniProt A0A0K8P8E7 (Palm et al., Nat. Commun. 2019).'
from public.plastics p where p.name = 'PET'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;

insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'Cutinase (LCC)',
  'MDGVLWRVRTAALMAALLALAAWALVWASPSVEAQSNPYQRGPDPTESMLEARSGPFSVSEENVSRLSASGFGGGTIYYPRENNTYGAVAISPGYTGTQASVAWLGERIASHGFVVITIDTNTTLDQPDSRARQLNAALDYMINDASSAVRSRIDSSRLAVMGHSMGGGGTLRLASQRPDLKAAIPLTPWHLNKNWSSVTVPTLIIGAEADTVAPVSQHAIPFYQNLPSTTPKVYVELDNASHFAPNSNNAAISVYTISWMKLWVDNDTRYRQFLCNVNDPALSDFRTNNRHCQ',
  'Leaf-branch compost cutinase (LCC): thermostable α/β-hydrolase cutinase that hydrolyses PET efficiently, especially in engineered variants (e.g. ICCG). One of the most industrially promising PET-degrading scaffolds.',
  'Starting reference — verify against UniProt G9BY57 (Sulaiman et al., 2012; Tournier et al., Nature 2020).'
from public.plastics p where p.name = 'PET'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;

-- PU (documented but less mature than PET) -----------------------------------
insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'Polyester esterase',
  'MNFPRASRLMQAAVLGGLMAVSAAATAQTNPYERGPNPTDALLEARSGPFSVSEERASRFGADGFGGGTIYYPRENNTYGAVAISPGYTGTEASIAWLGERIASHGFVVIAIDTITTLDQPDSRAEQLNAALNHMINRASSTVRSRIDSSRLAVMGHSMGGGGTLRLASQRPDLKAAIPLTPWHTDKTFNTSVPVLIVGAEADTVAPVSSHSEPFYNSLPSSISKAYLELDGATHFAPNIPNKIIGKYSVAWLKRFVDNDTRYTQFLCPGPRDGLFGEVEEYRSTCPF',
  'Serine esterases (α/β-hydrolase fold) cleave the ester linkages in polyester-type polyurethanes. Documented PU-degrading activity (e.g. Pseudomonas / Comamonas esterases) but less mature and more formulation-dependent than PET degradation.',
  'Starting reference (emerging) — verify against a PU-degrading esterase such as Pseudomonas PueA/PulA lineage; refine with real literature.'
from public.plastics p where p.name = 'PU'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;

insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'Urease',
  'MKLSPREVEKLGLHNAGYLAQKRLARGVRLNYTEAVALIASQIMEYARDGEKTVAQLMCLGQHLLGRRQVLPAVPHLLNAVQVEATFPDGTKLVTVHDPISRENGELQEALFGSLLPVPSLDKFAETKEDNRIPGEILCEDECDTLKLKVKNTGDRPIQVGSHYHFAEVNPYLTFDRRKAYGMRLDIAAGTAVRFEPGDCKSVTLVSIGGNKVIRGGNAIADGPVNETNLEAAMHAVRSKGFGHEEEKDASEGFTKEDPNCPFNTFIHRKEYANKYGPTTGDKIRLGDTNLLAEIEKDYALYGDECVFGGGKVIRDGMGQSCGHPPAISLDTVITNAVIIDYTGIIKADIGIKDGLIASIGKAGNPDIMNGVFSNMIIGANTEVIAGEGLIVTAGAIDCHVHYICPQLVYEAISSGITTLVGGGTGPAAGTRATTCTPSPTQMRLMLQSTDDLPLNFGFTGKGSSSKPDELHEIIKAGAMGLKLHEDWGSTPAAIDNCLTIAEHHDIQVNIHTDTLNEAGFVEHSIAAFKGRTIHTYHSEGAGGGHAPDIIKVAGEHNILPASTNPTIPFTVNTEAEHMDMLMVCHHLDKSIKEDVQFADSRIRPQTIAAEDVLHDLGAFSLTSSDSQAMGRVGEVISRTWQTADKNKKEFGRLKEEKGDNDNFRIKRYLSKYTINPAIAHGISEYVGSVEVGKVADLVLWSPAFFGVKPNMIIKGGFIALSQMGDANASIPTPQPVYYREMFAHHGKAKYDANITFVSQAAYDKGIKEELGLERQVLPVKNCRNISKKDMQFNDTTAHIEVNPETYHVFVDGKEVTSKPANKVSLAQLFSIF',
  'Ureases hydrolyse the urea/urethane linkages in polyurethane, releasing amines and CO2. Complementary to esterase routes but activity on synthetic PU is EMERGING and largely inferred — flag as less established.',
  'Starting reference (emerging) — verify against a characterised urease (e.g. UniProt P18314 lineage); refine with real literature.'
from public.plastics p where p.name = 'PU'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;

-- PE / PP (EMERGING, speculative — flag strongly) ----------------------------
insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'Laccase',
  'MSGYQNKEQMTLTIRRVEHDIVIPDGVERPWGFNGSFLGPTIRARRGDRVRIYVENQLPEHTTLHWHGLPISPKVDDPFLDLPPGESWTYEFTVPEDHPAGLFWYHPHLHGSTALQVSSGLAGALIVEDDESDALKLPKEYGVDDIPLIIQDRRFDANGQLDYQLDVMTAAVGWFGDTLLTNGAVYPQHAAPRGWLRLRLLNGCNARSLNFATSDNRPLYVIASDGGLLPEPVKVSELPVLMGERFEVLVEVNDNKPFDLVTLPVSQMGMAIAPFDKPHPVMRIQPIAISASGALPDTLSSLPALPSLEGLTVRKLQLSMDPMLDMMGMQMLMEKYGDQAMAGMDHSQMMGHMGHGNMNHMNHGGKFDFHHANKINGQAFDMNKPMFAAAKGQYERWVISGVGDMDHPFHLHGTQFRILSENGKPPAAHRAGWKDTVKVEGNVSEVLVKFNHDAPKEHAYMAHCHLLEHEDTGMMLGFTV',
  'Multi-copper oxidase (laccase) that can oxidatively modify the inert C-C backbone of polyethylene, introducing carbonyl groups and lowering molecular weight. EMERGING candidate only — no hydrolysable bonds exist in PE, so true depolymerisation is unproven. STRONGLY less established than PET enzymes.',
  'Starting reference (highly speculative) — verify against a characterised laccase (e.g. UniProt Q12718 / CotA lineage); treat as exploratory.'
from public.plastics p where p.name = 'PE'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;

insert into public.enzyme_families (plastic_id, name, reference_sequence, rationale, source_citation)
select p.id, 'Manganese peroxidase',
  'MAFKQLLAALSVALTLQAAHAAVCPDGTRVTNAACCAFIPLAQDLQETIFQNECGEDAHEVIRLTFHDAIAISRSQGPKAGGGADGSMLLFPTVEPNFSANNGIDDSVNNLIPFMQKHNTISAADLVQFAGAVALSNCPGAPRLEFLAGRPNKTIAAVDGLIPEPQDSVTKILQRFEDAGGFTPFEVVSLLASHSVARADKVDQTIDAAPFDSTPFTFDTQVFLEVLLKGVGFPGSANNTGEVASPLPLGSGSDTGEMRLQSDFALAHDPRTACIWQGFVNEQAFMAASFRAAMSKLAVLGHNRNSLIDCSDVVPVPKPATGQPAMFPASTGPQDLELSCPSERFPTLTTQPGASQSLIAHCPDGSMSCPGVQFNGPA',
  'Lignin-modifying Mn peroxidase generates diffusible Mn3+ oxidants that abstract hydrogen and introduce carbonyls into PE/PP backbones. EMERGING oxidative candidate only; genuine polyolefin depolymerisation remains speculative. STRONGLY less established than PET enzymes.',
  'Starting reference (highly speculative) — verify against a characterised MnP (e.g. UniProt Q02567 lineage); treat as exploratory.'
from public.plastics p where p.name = 'PP'
on conflict (plastic_id, name) do update
  set reference_sequence = excluded.reference_sequence,
      rationale          = excluded.rationale,
      source_citation    = excluded.source_citation;
