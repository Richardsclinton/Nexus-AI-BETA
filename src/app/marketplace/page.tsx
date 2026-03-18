"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

type ResourceType = "legal" | "knowledge" | "domain" | "compliance" | "research";

interface MarketplaceItem {
  id: string;
  title: string;
  type: ResourceType;
  category: string;
  quality: string;
  useCase: string;
  price: string;
  description: string;
}

const MOCK_ITEMS: MarketplaceItem[] = [
  {
    id: "1",
    title: "EU Legal Framework Pack",
    type: "legal",
    category: "Regulation",
    quality: "Verified",
    useCase: "Compliance, contract generation, legal Q&A",
    price: "0.25 USDC",
    description: "Structured knowledge pack covering key EU regulations (GDPR, DSA, DMA) for LLM grounding in legal contexts.",
  },
  {
    id: "2",
    title: "Medical Terminology & Codes (ICD-11)",
    type: "domain",
    category: "Healthcare",
    quality: "Certified",
    useCase: "Medical summaries, coding assistance, documentation",
    price: "0.50 USDC",
    description: "Structured medical terminology and ICD-11 codes to improve accuracy in healthcare-related outputs.",
  },
  {
    id: "3",
    title: "Financial Reporting Standards",
    type: "compliance",
    category: "Finance",
    quality: "Verified",
    useCase: "Report drafting, audit support, disclosure checks",
    price: "0.35 USDC",
    description: "IFRS and GAAP-aligned structured data for financial document generation and validation.",
  },
  {
    id: "4",
    title: "Technical Documentation Corpus",
    type: "knowledge",
    category: "Engineering",
    quality: "Community",
    useCase: "API docs, runbooks, troubleshooting",
    price: "0.15 USDC",
    description: "Curated technical documentation patterns to reinforce clarity and structure in generated docs.",
  },
  {
    id: "5",
    title: "Research Citation Pack",
    type: "research",
    category: "Academic",
    quality: "Verified",
    useCase: "Literature review, citation formatting, fact-checking",
    price: "0.40 USDC",
    description: "Structured citation and reference formats to improve academic-style outputs.",
  },
  // Additional packs to enrich the marketplace
  {
    id: "6",
    title: "DeFi Protocol Knowledge Pack",
    type: "domain",
    category: "DeFi",
    quality: "Verified",
    useCase: "On-chain analysis, protocol breakdowns, risk reports",
    price: "0.45 USDC",
    description: "Curated knowledge of major DeFi protocols, primitives, and risk patterns for financial agents.",
  },
  {
    id: "7",
    title: "Startup Fundraising Data Room",
    type: "knowledge",
    category: "Startup",
    quality: "Community",
    useCase: "Pitch decks, investor updates, financial modeling support",
    price: "0.30 USDC",
    description: "Templates and structured content for fundraising narratives, KPIs, and investor communication.",
  },
  {
    id: "8",
    title: "Cybersecurity Incident Playbooks",
    type: "compliance",
    category: "Security",
    quality: "Verified",
    useCase: "Incident response, runbooks, escalation procedures",
    price: "0.55 USDC",
    description: "Operational playbooks for security incidents, from detection to remediation and reporting.",
  },
  {
    id: "9",
    title: "E-commerce Customer Support Corpus",
    type: "knowledge",
    category: "E-commerce",
    quality: "Community",
    useCase: "Support chat, FAQ generation, macro suggestions",
    price: "0.18 USDC",
    description: "Patterns and dialogues for high-quality e-commerce customer support experiences.",
  },
  {
    id: "10",
    title: "Tokenomics & Governance Library",
    type: "research",
    category: "Web3",
    quality: "Verified",
    useCase: "Protocol design, tokenomics simulation, governance summaries",
    price: "0.60 USDC",
    description: "Structured reference library of token models, governance frameworks, and incentive mechanisms.",
  },
  {
    id: "11",
    title: "Enterprise HR Policy Pack",
    type: "legal",
    category: "HR",
    quality: "Verified",
    useCase: "Policy drafting, handbook generation, HR Q&A",
    price: "0.32 USDC",
    description: "Multi-region HR policies and templates designed for enterprise-grade HR copilots.",
  },
  {
    id: "12",
    title: "Quantitative Trading Research Notes",
    type: "research",
    category: "Trading",
    quality: "Community",
    useCase: "Strategy explanation, backtest reporting, alpha write-ups",
    price: "0.28 USDC",
    description: "Anonymised research notes and backtest descriptions for quantitative trading assistants.",
  },
  // Extra packs to significantly grow the marketplace inventory
  {
    id: "13",
    title: "AI Safety & Alignment Corpus",
    type: "research",
    category: "AI Safety",
    quality: "Verified",
    useCase: "Safety evaluations, red-teaming scenarios, alignment reports",
    price: "0.70 USDC",
    description: "Expert-curated materials on AI safety, alignment, and risk mitigation for advanced governance agents.",
  },
  {
    id: "14",
    title: "Crypto Regulatory Landscape Pack",
    type: "legal",
    category: "Regulation",
    quality: "Verified",
    useCase: "Jurisdiction comparison, compliance checks, licensing workflows",
    price: "0.55 USDC",
    description: "Multi-jurisdiction regulatory summaries for crypto, exchanges, and stablecoins.",
  },
  {
    id: "15",
    title: "VC Investment Memo Library",
    type: "knowledge",
    category: "Venture Capital",
    quality: "Community",
    useCase: "Memo drafting, deal analysis, portfolio updates",
    price: "0.29 USDC",
    description: "A structured library of anonymised VC memos and deal notes to train capital allocation agents.",
  },
  {
    id: "16",
    title: "KYC / AML Policy Templates",
    type: "compliance",
    category: "Finance",
    quality: "Verified",
    useCase: "Policy drafting, onboarding flows, compliance reviews",
    price: "0.48 USDC",
    description: "Ready-to-adapt policies and workflows for KYC / AML compliance in fintech and exchanges.",
  },
  {
    id: "17",
    title: "UX Copy & Microcopy Patterns",
    type: "knowledge",
    category: "Product",
    quality: "Community",
    useCase: "Interface texts, onboarding flows, empty states",
    price: "0.19 USDC",
    description: "High-quality UX text patterns for product surfaces, error states, and onboarding.",
  },
  {
    id: "18",
    title: "Growth Experiment Playbooks",
    type: "knowledge",
    category: "Growth",
    quality: "Community",
    useCase: "Experiment design, KPI tracking, reporting",
    price: "0.27 USDC",
    description: "Growth experiment templates across acquisition, activation, retention, and monetisation.",
  },
  {
    id: "19",
    title: "Corporate Governance Toolkit",
    type: "legal",
    category: "Corporate",
    quality: "Verified",
    useCase: "Board materials, resolutions, corporate housekeeping",
    price: "0.38 USDC",
    description: "Structured governance documents and checklists for corporations and DAOs.",
  },
  {
    id: "20",
    title: "Supply Chain Contracts Pack",
    type: "legal",
    category: "Logistics",
    quality: "Verified",
    useCase: "Contract drafting, vendor agreements, SLAs",
    price: "0.41 USDC",
    description: "Templates and clause libraries for logistics, procurement, and supply-chain agreements.",
  },
  {
    id: "21",
    title: "Creator Economy Data Pack",
    type: "domain",
    category: "Creator",
    quality: "Community",
    useCase: "Campaign briefs, sponsorship offers, pricing models",
    price: "0.22 USDC",
    description: "Structured content for creator deals, campaign coordination, and sponsorship workflows.",
  },
  {
    id: "22",
    title: "Manufacturing Ops Manuals",
    type: "knowledge",
    category: "Industry",
    quality: "Verified",
    useCase: "SOP generation, maintenance schedules, troubleshooting",
    price: "0.52 USDC",
    description: "Standard operating procedures and ops manuals for industrial and manufacturing settings.",
  },
  {
    id: "23",
    title: "Retail Operations Playbook",
    type: "knowledge",
    category: "Retail",
    quality: "Community",
    useCase: "Store ops, shift planning, issue escalation",
    price: "0.21 USDC",
    description: "Operational guidance for retail stores, including staffing, merchandising, and escalation paths.",
  },
  {
    id: "24",
    title: "Hospitality Service Scripts",
    type: "knowledge",
    category: "Hospitality",
    quality: "Community",
    useCase: "Hotel support, concierge, guest messaging",
    price: "0.20 USDC",
    description: "Dialogue patterns and workflows for hotels, hospitality desks, and guest support agents.",
  },
  {
    id: "25",
    title: "Onboarding Journeys Library",
    type: "knowledge",
    category: "Product",
    quality: "Community",
    useCase: "User onboarding, email sequences, in-app walkthroughs",
    price: "0.26 USDC",
    description: "Examples of high performing onboarding journeys across SaaS and consumer apps.",
  },
  {
    id: "26",
    title: "Incident Postmortem Templates",
    type: "compliance",
    category: "Engineering",
    quality: "Verified",
    useCase: "Post-incident reports, RCA documents, action items",
    price: "0.24 USDC",
    description: "Structured templates and examples for engineering and infrastructure incident postmortems.",
  },
  {
    id: "27",
    title: "Data Privacy Impact Assessment Pack",
    type: "compliance",
    category: "Privacy",
    quality: "Verified",
    useCase: "DPIA drafting, risk assessments, privacy reviews",
    price: "0.46 USDC",
    description: "Guided DPIA structures for GDPR and other privacy frameworks.",
  },
  {
    id: "28",
    title: "SEO Content Brief Templates",
    type: "knowledge",
    category: "Marketing",
    quality: "Community",
    useCase: "SEO article briefs, keyword mapping, outline planning",
    price: "0.23 USDC",
    description: "Content brief structures for SEO-driven content and landing pages.",
  },
  {
    id: "29",
    title: "Investor Relations Pack",
    type: "knowledge",
    category: "Finance",
    quality: "Verified",
    useCase: "Earnings summaries, IR emails, KPI snapshots",
    price: "0.37 USDC",
    description: "Communication patterns for investor reporting, KPI dashboards, and quarterly updates.",
  },
  {
    id: "30",
    title: "Healthcare Consent Forms Library",
    type: "legal",
    category: "Healthcare",
    quality: "Verified",
    useCase: "Patient forms, consent language, privacy notices",
    price: "0.44 USDC",
    description: "Region-aware templates for patient consent, informed procedures, and privacy communications.",
  },
  {
    id: "31",
    title: "Education Course Syllabus Pack",
    type: "knowledge",
    category: "Education",
    quality: "Community",
    useCase: "Syllabus design, course planning, assignment schedules",
    price: "0.18 USDC",
    description: "Sample syllabi and course outlines across STEM, humanities, and arts.",
  },
  {
    id: "32",
    title: "Customer Success Runbooks",
    type: "knowledge",
    category: "SaaS",
    quality: "Community",
    useCase: "CS workflows, QBR templates, success plans",
    price: "0.28 USDC",
    description: "Playbooks and success plans for SaaS customer success organisations.",
  },
  {
    id: "33",
    title: "Procurement RFP Templates",
    type: "compliance",
    category: "Procurement",
    quality: "Verified",
    useCase: "RFP creation, vendor evaluation, scoring matrices",
    price: "0.39 USDC",
    description: "Structured RFP templates and evaluation frameworks for enterprise procurement.",
  },
  {
    id: "34",
    title: "Gaming Community Moderation Pack",
    type: "knowledge",
    category: "Gaming",
    quality: "Community",
    useCase: "Community guidelines, moderation decisions, escalation",
    price: "0.19 USDC",
    description: "Patterns for moderation, rules, and escalation across gaming communities.",
  },
  {
    id: "35",
    title: "Design System Documentation",
    type: "knowledge",
    category: "Design",
    quality: "Community",
    useCase: "Design system docs, component guidelines, usage rules",
    price: "0.31 USDC",
    description: "Examples of design system documentation and component specs for UI libraries.",
  },
  {
    id: "36",
    title: "Real Estate Transaction Pack",
    type: "legal",
    category: "Real Estate",
    quality: "Verified",
    useCase: "Offer letters, purchase agreements, rental contracts",
    price: "0.49 USDC",
    description: "Common documents and clauses for residential and commercial real estate deals.",
  },
  {
    id: "37",
    title: "Research Survey Toolkit",
    type: "research",
    category: "Product",
    quality: "Community",
    useCase: "User surveys, feedback forms, research prompts",
    price: "0.17 USDC",
    description: "Survey question banks and structures for user, market, and product research.",
  },
  {
    id: "38",
    title: "HR Performance Review Forms",
    type: "knowledge",
    category: "HR",
    quality: "Verified",
    useCase: "Performance reviews, feedback cycles, calibration",
    price: "0.27 USDC",
    description: "Templates for structured performance reviews and feedback sessions.",
  },
  {
    id: "39",
    title: "Energy Market Fundamentals Pack",
    type: "domain",
    category: "Energy",
    quality: "Research",
    useCase: "Pricing analysis, market summaries, policy overviews",
    price: "0.53 USDC",
    description: "Reference data and explanations for global energy markets and pricing structures.",
  },
  {
    id: "40",
    title: "Climate Policy & ESG Corpus",
    type: "research",
    category: "Sustainability",
    quality: "Verified",
    useCase: "ESG reports, climate disclosures, sustainability plans",
    price: "0.59 USDC",
    description: "ESG and climate policy materials for sustainability reporting assistants.",
  },
  {
    id: "41",
    title: "Marketing Funnel Metrics Pack",
    type: "knowledge",
    category: "Marketing",
    quality: "Community",
    useCase: "Funnel analysis, KPI dashboards, performance narratives",
    price: "0.24 USDC",
    description: "Common funnel models and KPI patterns for acquisition and retention reporting.",
  },
  {
    id: "42",
    title: "B2B Sales Playbooks",
    type: "knowledge",
    category: "Sales",
    quality: "Community",
    useCase: "Sales sequences, objection handling, pipeline reviews",
    price: "0.33 USDC",
    description: "Email sequences and meeting frameworks for B2B sales and account management.",
  },
  {
    id: "43",
    title: "Insurance Claims Pack",
    type: "domain",
    category: "Insurance",
    quality: "Verified",
    useCase: "Claims triage, documentation, and communication",
    price: "0.47 USDC",
    description: "Claim templates, coverage language, and workflows for insurance assistants.",
  },
  {
    id: "44",
    title: "Logistics Network Data Pack",
    type: "domain",
    category: "Logistics",
    quality: "Research",
    useCase: "Route optimisation, shipment summaries, ETA estimations",
    price: "0.52 USDC",
    description: "Structures for modelling shipments, hubs, and routes in logistics agents.",
  },
  {
    id: "45",
    title: "Legal Discovery Summaries",
    type: "legal",
    category: "Litigation",
    quality: "Verified",
    useCase: "Case summaries, discovery indexing, brief drafting",
    price: "0.63 USDC",
    description: "Patterns for summarising and indexing large discovery sets in legal workflows.",
  },
  {
    id: "46",
    title: "Open Source Governance Pack",
    type: "knowledge",
    category: "Open Source",
    quality: "Community",
    useCase: "Governance docs, contribution guidelines, codes of conduct",
    price: "0.19 USDC",
    description: "Templates and examples for open-source governance, community, and licensing.",
  },
  {
    id: "47",
    title: "High-Stakes Communication Pack",
    type: "knowledge",
    category: "Comms",
    quality: "Verified",
    useCase: "Crisis comms, press releases, executive updates",
    price: "0.51 USDC",
    description: "Communication frameworks for high-stakes announcements and crisis response.",
  },
  {
    id: "48",
    title: "Product Requirements Documents Library",
    type: "knowledge",
    category: "Product",
    quality: "Community",
    useCase: "PRDs, specs, feature breakdowns",
    price: "0.29 USDC",
    description: "Sample PRDs and feature specs to guide product documentation agents.",
  },
  {
    id: "49",
    title: "Mobile App Review Insights Pack",
    type: "research",
    category: "Product",
    quality: "Community",
    useCase: "Sentiment analysis, feature requests, churn reasons",
    price: "0.22 USDC",
    description: "Aggregated patterns from mobile app reviews to power feedback analysis.",
  },
  {
    id: "50",
    title: "Protocol Grants & Funding Pack",
    type: "research",
    category: "Web3",
    quality: "Community",
    useCase: "Grant applications, milestone plans, evaluation forms",
    price: "0.34 USDC",
    description: "Structures and examples for Web3 grant programs and funding pipelines.",
  },
  {
    id: "51",
    title: "Real-Time Ops Alert Library",
    type: "knowledge",
    category: "Ops",
    quality: "Community",
    useCase: "Alert wording, runbooks, escalation steps",
    price: "0.21 USDC",
    description: "Alert templates and responses for SRE, infra, and operations teams.",
  },
  {
    id: "52",
    title: "Token Launch Legal Checklist",
    type: "legal",
    category: "Web3",
    quality: "Verified",
    useCase: "Token launch preparation, jurisdiction review, disclosures",
    price: "0.68 USDC",
    description: "Legal checklists and disclosures for compliant token launches and distributions.",
  },
];

// Génère automatiquement ~200 items supplémentaires dans des domaines variés
const AUTO_ITEMS: MarketplaceItem[] = Array.from({ length: 200 }, (_, index) => {
  const id = (MOCK_ITEMS.length + index + 1).toString();
  const domains = [
    { category: "AI Science", type: "research" as ResourceType },
    { category: "Biology", type: "domain" as ResourceType },
    { category: "Medical Science", type: "domain" as ResourceType },
    { category: "Educational Science", type: "knowledge" as ResourceType },
    { category: "Psychology", type: "research" as ResourceType },
    { category: "Technology", type: "knowledge" as ResourceType },
    { category: "Web3", type: "domain" as ResourceType },
    { category: "Cryptocurrency", type: "domain" as ResourceType },
    { category: "Insurance", type: "legal" as ResourceType },
    { category: "AI Assurance", type: "compliance" as ResourceType },
  ];

  const d = domains[index % domains.length];
  const qualityCycle = ["Community", "Verified", "Research", "Certified"] as const;
  const quality = qualityCycle[index % qualityCycle.length];

  return {
    id,
    title: `${d.category} Pack #${index + 1}`,
    type: d.type,
    category: d.category,
    quality,
    useCase: `Advanced ${d.category.toLowerCase()} workflows, analysis and decision support.`,
    price: `${(0.15 + (index % 10) * 0.03).toFixed(2)} USDC`,
    description: `High-quality structured data and patterns for ${d.category.toLowerCase()} agents: classification, summarisation, and reasoning.`,
  };
});

MOCK_ITEMS.push(...AUTO_ITEMS);

const TYPE_LABELS: Record<ResourceType, string> = {
  legal: "Legal",
  knowledge: "Knowledge",
  domain: "Domain",
  compliance: "Compliance",
  research: "Research",
};

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ResourceType | "">("");
  const [selected, setSelected] = useState<MarketplaceItem | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -9999, y: -9999 });
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const filtered = MOCK_ITEMS.filter((item) => {
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.useCase.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || item.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 relative">
      <div className="w-full max-w-[1920px] mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-light-blue via-neon-pink to-light-blue bg-clip-text text-transparent">
            [MARKETPLACE]
          </h1>
          <p className="text-sm md:text-base text-white/70 max-w-2xl mx-auto">
            Information and data resources to strengthen your LLM capabilities. Legal packs, knowledge bases, domain-specific modules, and compliance data.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neon-pink/40 bg-neon-pink/10 text-[11px] md:text-xs text-neon-pink font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-pink animate-pulse" />
            <span>soon at&nbsp;$NXS launch</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                placeholder="Search by title, category, use case…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-black/40 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 focus:ring-2 focus:ring-neon-pink/20 transition-all"
              />
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TYPE_LABELS) as ResourceType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? "" : type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterType === type
                        ? "bg-neon-pink/20 border border-neon-pink/40 text-neon-pink"
                        : "border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20"
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelected(item)}
                  className="p-5 rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm hover:border-neon-pink/30 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-light-blue/20 text-light-blue border border-light-blue/40">
                      {TYPE_LABELS[item.type]}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mb-2">{item.category} · {item.quality}</p>
                  <p className="text-sm text-white/70 line-clamp-2">{item.useCase}</p>
                  <p className="text-sm text-neon-pink font-semibold mt-2">{item.price}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24 p-6 rounded-2xl border border-neon-pink/20 bg-black/50 backdrop-blur-sm min-h-[320px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neon-pink">DETAILS</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-neon-pink/40 bg-neon-pink/10 text-neon-pink tracking-wide uppercase">
                  Preview
                </span>
              </div>
              {selected ? (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-white">{selected.title}</h4>
                  <p className="text-xs text-white/50">
                    {selected.category} · {selected.quality} · {TYPE_LABELS[selected.type]}
                  </p>
                  <p className="text-sm text-white/70">{selected.description}</p>
                  <p className="text-sm text-white/60">
                    <span className="text-white/80">Use case:</span> {selected.useCase}
                  </p>
                  <p className="text-lg font-semibold text-neon-pink">{selected.price}</p>
                  <button
                    type="button"
                    className="w-full px-4 py-3 rounded-lg bg-neon-pink/20 border border-neon-pink/40 text-neon-pink font-semibold text-sm hover:bg-neon-pink/30 transition-all"
                  >
                    Purchase / Subscribe
                  </button>
                </div>
              ) : (
                <p className="text-sm text-white/50">Select an item to view details and purchase.</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Full-page preview overlay (below navbar) */}
      {showPreview && (
        <div
          className="fixed inset-x-0 top-12 bottom-0 z-40 flex items-center justify-center"
          style={{
            background: `radial-gradient(
              circle at ${cursorPos.x}px ${cursorPos.y}px,
              rgba(255,123,198,0.22) 0,
              rgba(255,123,198,0.15) 90px,
              rgba(0,0,0,0.78) 170px
            )`,
            backdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-xl px-8 py-8 rounded-2xl border border-neon-pink/40 bg-black/90 text-center shadow-[0_0_40px_rgba(255,123,198,0.4)]"
          >
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-4 top-4 text-white/60 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-2xl md:text-3xl font-semibold text-neon-pink mb-3">
              Nexus Marketplace
            </h2>
            <div className="relative w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden border border-neon-pink/60 bg-black/80">
              <Image
                src="/DAPP%20LOGO/MARKETPLACE.png"
                alt="Nexus Marketplace"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-sm text-white/70 mb-3">
              Available data and outputs of the $NXS ecosystem will appear here.
            </p>
            <p className="text-sm text-white/60 mb-3">
              The Marketplace is currently in preparation and will be progressively integrated into the Nexus private dApp.
            </p>
            <p className="text-sm text-white/60 mb-4">
              This interface will later display available marketplace modules, execution outputs, ecosystem data, and future components connected to the $NXS infrastructure.
            </p>
            <div className="flex items-center justify-center gap-1 text-neon-pink/80 text-xs">
              <span className="w-2 h-2 rounded-full bg-neon-pink animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-neon-pink/70 animate-[pulse_1.4s_ease-in-out_infinite_0.2s]" />
              <span className="w-2 h-2 rounded-full bg-neon-pink/50 animate-[pulse_1.4s_ease-in-out_infinite_0.4s]" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
