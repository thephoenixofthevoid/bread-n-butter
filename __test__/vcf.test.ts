
import { snapTest } from "./util";
import * as bnb from "../src/bread-n-butter";
const { match: R, all: S, lazy: L, choice: C } = bnb



namespace VCF {
    const join = array => Object.assign({}, ...array)
    const lineEnd = C("\n", bnb.eof)
    const TValue: bnb.Parser<any> = L(() => C(TString, TObject, TBare, TSymbol, TDigit))

    const TSymbol   = R(/[a-zA-Z_][a-zA-Z0-9_]+/)
    const TBare     = R(/[^,;<>"=\n#]+/)
    const TBareLong = R(/[^<>"\n#]+/)
    const TDigit    = R(/[0-9.N]+/)
    const TString   = R(/"((?:\\.|.)*?)"/)
    const TPair     = S(TSymbol, "=", TValue).map(([K, _, V]) => ({ [K]: V }))

    const TObject = TPair.sepBy(",").map(join)
                         .sepBy(";").wrap("<", ">")

    

    const TMetaLine = C(
        S("##", TSymbol, "=", TObject  , lineEnd),
        S("##", TSymbol, "=", TBareLong, lineEnd),
    ).map(([_, K, __, V]) => ({ [K]: V }));

    export const Header = TMetaLine.repeat()
}




test("VCF", () => {
  const text = `##fileformat=VCFv4.2
##FILTER=<ID=PASS,Description="All filters passed">
##FILTER=<ID=FAIL,Description="Fail the site if all alleles fail but for different reasons.">
##FILTER=<ID=base_qual,Description="alt median base quality">
##FILTER=<ID=clustered_events,Description="Clustered events observed in the tumor">
##FILTER=<ID=contamination,Description="contamination">
##FILTER=<ID=duplicate,Description="evidence for alt allele is overrepresented by apparent duplicates">
##FILTER=<ID=fragment,Description="abs(ref - alt) median fragment length">
##FILTER=<ID=germline,Description="Evidence indicates this site is germline, not somatic">
##FILTER=<ID=haplotype,Description="Variant near filtered variant on same haplotype.">
##FILTER=<ID=low_allele_frac,Description="Allele fraction is below specified threshold">
##FILTER=<ID=map_qual,Description="ref - alt median mapping quality">
##FILTER=<ID=multiallelic,Description="Site filtered because too many alt alleles pass tumor LOD">
##FILTER=<ID=n_ratio,Description="Ratio of N to alt exceeds specified ratio">
##FILTER=<ID=normal_artifact,Description="artifact_in_normal">
##FILTER=<ID=orientation,Description="orientation bias detected by the orientation bias mixture model">
##FILTER=<ID=panel_of_normals,Description="Blacklisted site in panel of normals">
##FILTER=<ID=position,Description="median distance of alt variants from end of reads">
##FILTER=<ID=possible_numt,Description="Allele depth is below expected coverage of NuMT in autosome">
##FILTER=<ID=slippage,Description="Site filtered due to contraction of short tandem repeat region">
##FILTER=<ID=strand_bias,Description="Evidence for alt allele comes from one read direction only">
##FILTER=<ID=strict_strand,Description="Evidence for alt allele is not represented in both directions">
##FILTER=<ID=weak_evidence,Description="Mutation does not meet likelihood threshold">
##FORMAT=<ID=AD,Number=R,Type=Integer,Description="Allelic depths for the ref and alt alleles in the order listed">
##FORMAT=<ID=AF,Number=A,Type=Float,Description="Allele fractions of alternate alleles in the tumor">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Approximate read depth (reads with MQ=255 or with bad mates are filtered)">
##FORMAT=<ID=F1R2,Number=R,Type=Integer,Description="Count of reads in F1R2 pair orientation supporting each allele">
##FORMAT=<ID=F2R1,Number=R,Type=Integer,Description="Count of reads in F2R1 pair orientation supporting each allele">
##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Genotype Quality">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=PGT,Number=1,Type=String,Description="Physical phasing haplotype information, describing how the alternate alleles are phased in relation to one another; will always be heterozygous and is not intended to describe called alleles">
##FORMAT=<ID=PID,Number=1,Type=String,Description="Physical phasing ID information, where each unique ID within a given sample (but not across samples) connects records within a phasing group">
##FORMAT=<ID=PL,Number=G,Type=Integer,Description="Normalized, Phred-scaled likelihoods for genotypes as defined in the VCF specification">
##FORMAT=<ID=PS,Number=1,Type=Integer,Description="Phasing set (typically the position of the first variant in the set)">
##FORMAT=<ID=SB,Number=4,Type=Integer,Description="Per-sample component statistics which comprise the Fisher's Exact Test to detect strand bias.">
##GATKCommandLine=<ID=FilterMutectCalls,CommandLine="FilterMutectCalls --output /home/gorbachevalex87/onco_test/somatic/mutect/mutect_somatic_2020_oncefiltered.vcf.gz --stats /home/gorbachevalex87/onco_test/somatic/mutect/mutect_new.vcf.gz.stats --contamination-table /home/gorbachevalex87/onco_test/somatic/mutect/pair_calculatecontamination.table --tumor-segmentation /home/gorbachevalex87/onco_test/somatic/mutect/segments.table --variant /home/gorbachevalex87/onco_test/somatic/mutect/mutect_somatic_2020.vcf.gz --reference /home/gorbachevalex87/onco_test/ref_data/genome/all/ref_genome.fa --threshold-strategy OPTIMAL_F_SCORE --f-score-beta 1.0 --false-discovery-rate 0.05 --initial-threshold 0.1 --mitochondria-mode false --max-events-in-region 2 --max-alt-allele-count 1 --unique-alt-read-count 0 --min-median-mapping-quality 30 --min-median-base-quality 20 --max-median-fragment-length-difference 10000 --min-median-read-position 1 --max-n-ratio Infinity --min-reads-per-strand 0 --min-allele-fraction 0.0 --contamination-estimate 0.0 --log-snv-prior -13.815510557964275 --log-indel-prior -16.11809565095832 --log-artifact-prior -2.302585092994046 --normal-p-value-threshold 0.001 --min-slippage-length 8 --pcr-slippage-rate 0.1 --distance-on-haplotype 100 --long-indel-length 5 --interval-set-rule UNION --interval-padding 0 --interval-exclusion-padding 0 --interval-merging-rule ALL --read-validation-stringency SILENT --seconds-between-progress-updates 10.0 --disable-sequence-dictionary-validation false --create-output-bam-index true --create-output-bam-md5 false --create-output-variant-index true --create-output-variant-md5 false --lenient false --add-output-sam-program-record true --add-output-vcf-command-line true --cloud-prefetch-buffer 40 --cloud-index-prefetch-buffer -1 --disable-bam-index-caching false --sites-only-vcf-output false --help false --version false --showHidden false --verbosity INFO --QUIET false --use-jdk-deflater false --use-jdk-inflater false --gcs-max-retries 20 --gcs-project-for-requester-pays  --disable-tool-default-read-filters false",Version="4.1.9.0",Date="December 9, 2020 7:12:42 PM MSK">
##GATKCommandLine=<ID=LeftAlignAndTrimVariants,CommandLine="LeftAlignAndTrimVariants --output /home/gorbachevalex87/onco_test/somatic/mutect/mutect_somatic_2020_oncefiltered.pass.normalized.vcf --variant /home/gorbachevalex87/onco_test/somatic/mutect/mutect_somatic_2020_oncefiltered.pass.vcf --reference /home/gorbachevalex87/onco_test/ref_data/genome/all/ref_genome.fa --dont-trim-alleles false --split-multi-allelics false --keep-original-ac false --max-indel-length 200 --max-leading-bases 1000 --suppress-reference-path false --interval-set-rule UNION --interval-padding 0 --interval-exclusion-padding 0 --interval-merging-rule ALL --read-validation-stringency SILENT --seconds-between-progress-updates 10.0 --disable-sequence-dictionary-validation false --create-output-bam-index true --create-output-bam-md5 false --create-output-variant-index true --create-output-variant-md5 false --lenient false --add-output-sam-program-record true --add-output-vcf-command-line true --cloud-prefetch-buffer 40 --cloud-index-prefetch-buffer -1 --disable-bam-index-caching false --sites-only-vcf-output false --help false --version false --showHidden false --verbosity INFO --QUIET false --use-jdk-deflater false --use-jdk-inflater false --gcs-max-retries 20 --gcs-project-for-requester-pays  --disable-tool-default-read-filters false",Version="4.1.9.0",Date="December 9, 2020 11:37:49 PM MSK">
##INFO=<ID=AS_FilterStatus,Number=A,Type=String,Description="Filter status for each allele, as assessed by ApplyRecalibration. Note that the VCF filter field will reflect the most lenient/sensitive status across all alleles.">
##INFO=<ID=AS_SB_TABLE,Number=1,Type=String,Description="Allele-specific forward/reverse read counts for strand bias tests. Includes the reference and alleles separated by |.">
##INFO=<ID=AS_UNIQ_ALT_READ_COUNT,Number=A,Type=Integer,Description="Number of reads with unique start and mate end positions for each alt at a variant site">
##INFO=<ID=CONTQ,Number=1,Type=Float,Description="Phred-scaled qualities that alt allele are not due to contamination">
##INFO=<ID=DP,Number=1,Type=Integer,Description="Approximate read depth; some reads may have been filtered">
##INFO=<ID=ECNT,Number=1,Type=Integer,Description="Number of events in this haplotype">
##INFO=<ID=GERMQ,Number=1,Type=Integer,Description="Phred-scaled quality that alt alleles are not germline variants">
##INFO=<ID=MBQ,Number=R,Type=Integer,Description="median base quality">
##INFO=<ID=MFRL,Number=R,Type=Integer,Description="median fragment length">
##INFO=<ID=MMQ,Number=R,Type=Integer,Description="median mapping quality">
##INFO=<ID=MPOS,Number=A,Type=Integer,Description="median distance from end of read">
##INFO=<ID=NALOD,Number=A,Type=Float,Description="Negative log 10 odds of artifact in normal with same allele fraction as tumor">
##INFO=<ID=NCount,Number=1,Type=Integer,Description="Count of N bases in the pileup">
##INFO=<ID=NLOD,Number=A,Type=Float,Description="Normal log 10 likelihood ratio of diploid het or hom alt genotypes">
##INFO=<ID=OCM,Number=1,Type=Integer,Description="Number of alt reads whose original alignment doesn't match the current contig.">
##INFO=<ID=PON,Number=0,Type=Flag,Description="site found in panel of normals">
##INFO=<ID=POPAF,Number=A,Type=Float,Description="negative log 10 population allele frequencies of alt alleles">
##INFO=<ID=ROQ,Number=1,Type=Float,Description="Phred-scaled qualities that alt allele are not due to read orientation artifact">
##INFO=<ID=RPA,Number=R,Type=Integer,Description="Number of times tandem repeat unit is repeated, for each allele (including reference)">
##INFO=<ID=RU,Number=1,Type=String,Description="Tandem repeat unit (bases)">
##INFO=<ID=SEQQ,Number=1,Type=Integer,Description="Phred-scaled quality that alt alleles are not sequencing errors">
##INFO=<ID=STR,Number=0,Type=Flag,Description="Variant is a short tandem repeat">
##INFO=<ID=STRANDQ,Number=1,Type=Integer,Description="Phred-scaled quality of strand bias artifact">
##INFO=<ID=STRQ,Number=1,Type=Integer,Description="Phred-scaled quality that alt alleles in STRs are not polymerase slippage errors">
##INFO=<ID=TLOD,Number=A,Type=Float,Description="Log 10 likelihood ratio score of variant existing versus not existing">
##MutectVersion=2.2
##bcftools_viewCommand=view -f PASS mutect_somatic_2020_oncefiltered.vcf.gz; Date=Wed Dec  9 19:17:12 2020
##bcftools_viewVersion=1.10.2+htslib-1.10.2
##contig=<ID=chr1,length=248956422,assembly=ref_genome.fa>
##contig=<ID=chr2,length=242193529,assembly=ref_genome.fa>
##contig=<ID=chr3,length=198295559,assembly=ref_genome.fa>
##contig=<ID=chr4,length=190214555,assembly=ref_genome.fa>
##contig=<ID=chr5,length=181538259,assembly=ref_genome.fa>
##contig=<ID=chr6,length=170805979,assembly=ref_genome.fa>
##contig=<ID=chr7,length=159345973,assembly=ref_genome.fa>
##contig=<ID=chr8,length=145138636,assembly=ref_genome.fa>
##contig=<ID=chr9,length=138394717,assembly=ref_genome.fa>
##contig=<ID=chr10,length=133797422,assembly=ref_genome.fa>
##contig=<ID=chr11,length=135086622,assembly=ref_genome.fa>
##contig=<ID=chr12,length=133275309,assembly=ref_genome.fa>
##contig=<ID=chr13,length=114364328,assembly=ref_genome.fa>
##contig=<ID=chr14,length=107043718,assembly=ref_genome.fa>
##contig=<ID=chr15,length=101991189,assembly=ref_genome.fa>
##contig=<ID=chr16,length=90338345,assembly=ref_genome.fa>
##contig=<ID=chr17,length=83257441,assembly=ref_genome.fa>
##contig=<ID=chr18,length=80373285,assembly=ref_genome.fa>
##contig=<ID=chr19,length=58617616,assembly=ref_genome.fa>
##contig=<ID=chr20,length=64444167,assembly=ref_genome.fa>
##contig=<ID=chr21,length=46709983,assembly=ref_genome.fa>
##contig=<ID=chr22,length=50818468,assembly=ref_genome.fa>
##contig=<ID=chrX,length=156040895,assembly=ref_genome.fa>
##contig=<ID=chrY,length=57227415,assembly=ref_genome.fa>
##contig=<ID=chrM,length=16569,assembly=ref_genome.fa>
##filtering_status=These calls have been filtered by FilterMutectCalls to label false positives with a list of failed filters and true positives with PASS.
##normal_sample=620103
##source=FilterMutectCalls
##source=LeftAlignAndTrimVariants
##tumor_sample=610103
##INFO=<ID=OLD_MULTIALLELIC,Number=1,Type=String,Description="Original chr:pos:ref:alt encoding">`;
  snapTest(VCF.Header, text);
});