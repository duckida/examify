export interface FeaturedPaper {
  id: string;
  subject: 'Biology' | 'Chemistry' | 'Physics' | 'Business';
  examBoard: string;
  year: number;
  session: string;
  paper: string;
  questionPaperUrl: string;
  markSchemeUrl: string;
}

const PMT_BASE = 'https://pmt.physicsandmathstutor.com/download';

function qpUrl(subject: string, paper: string, year: number): string {
  return `${PMT_BASE}/${subject}/GCSE/Past-Papers/AQA/${paper}/QP/June%20${year}%20QP.pdf`;
}

function msUrl(subject: string, paper: string, year: number): string {
  return `${PMT_BASE}/${subject}/GCSE/Past-Papers/AQA/${paper}/MS/June%20${year}%20MS.pdf`;
}

export const FEATURED_PAPERS: FeaturedPaper[] = [
  // Biology
  { id: 'bio-2024-1h', subject: 'Biology', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Biology', 'Paper-1H', 2024), markSchemeUrl: msUrl('Biology', 'Paper-1H', 2024) },
  { id: 'bio-2024-2h', subject: 'Biology', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Biology', 'Paper-2H', 2024), markSchemeUrl: msUrl('Biology', 'Paper-2H', 2024) },
  { id: 'bio-2023-1h', subject: 'Biology', examBoard: 'AQA', year: 2023, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Biology', 'Paper-1H', 2023), markSchemeUrl: msUrl('Biology', 'Paper-1H', 2023) },
  { id: 'bio-2023-2h', subject: 'Biology', examBoard: 'AQA', year: 2023, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Biology', 'Paper-2H', 2023), markSchemeUrl: msUrl('Biology', 'Paper-2H', 2023) },
  { id: 'bio-2022-1h', subject: 'Biology', examBoard: 'AQA', year: 2022, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Biology', 'Paper-1H', 2022), markSchemeUrl: msUrl('Biology', 'Paper-1H', 2022) },
  { id: 'bio-2022-2h', subject: 'Biology', examBoard: 'AQA', year: 2022, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Biology', 'Paper-2H', 2022), markSchemeUrl: msUrl('Biology', 'Paper-2H', 2022) },
  { id: 'bio-2021-1h', subject: 'Biology', examBoard: 'AQA', year: 2021, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Biology', 'Paper-1H', 2021), markSchemeUrl: msUrl('Biology', 'Paper-1H', 2021) },
  { id: 'bio-2021-2h', subject: 'Biology', examBoard: 'AQA', year: 2021, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Biology', 'Paper-2H', 2021), markSchemeUrl: msUrl('Biology', 'Paper-2H', 2021) },
  { id: 'bio-2020-1h', subject: 'Biology', examBoard: 'AQA', year: 2020, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Biology', 'Paper-1H', 2020), markSchemeUrl: msUrl('Biology', 'Paper-1H', 2020) },
  { id: 'bio-2020-2h', subject: 'Biology', examBoard: 'AQA', year: 2020, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Biology', 'Paper-2H', 2020), markSchemeUrl: msUrl('Biology', 'Paper-2H', 2020) },

  // Chemistry
  { id: 'chem-2024-1h', subject: 'Chemistry', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Chemistry', 'Paper-1H', 2024), markSchemeUrl: msUrl('Chemistry', 'Paper-1H', 2024) },
  { id: 'chem-2024-2h', subject: 'Chemistry', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Chemistry', 'Paper-2H', 2024), markSchemeUrl: msUrl('Chemistry', 'Paper-2H', 2024) },
  { id: 'chem-2023-1h', subject: 'Chemistry', examBoard: 'AQA', year: 2023, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Chemistry', 'Paper-1H', 2023), markSchemeUrl: msUrl('Chemistry', 'Paper-1H', 2023) },
  { id: 'chem-2023-2h', subject: 'Chemistry', examBoard: 'AQA', year: 2023, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Chemistry', 'Paper-2H', 2023), markSchemeUrl: msUrl('Chemistry', 'Paper-2H', 2023) },
  { id: 'chem-2022-1h', subject: 'Chemistry', examBoard: 'AQA', year: 2022, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Chemistry', 'Paper-1H', 2022), markSchemeUrl: msUrl('Chemistry', 'Paper-1H', 2022) },
  { id: 'chem-2022-2h', subject: 'Chemistry', examBoard: 'AQA', year: 2022, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Chemistry', 'Paper-2H', 2022), markSchemeUrl: msUrl('Chemistry', 'Paper-2H', 2022) },
  { id: 'chem-2021-1h', subject: 'Chemistry', examBoard: 'AQA', year: 2021, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Chemistry', 'Paper-1H', 2021), markSchemeUrl: msUrl('Chemistry', 'Paper-1H', 2021) },
  { id: 'chem-2021-2h', subject: 'Chemistry', examBoard: 'AQA', year: 2021, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Chemistry', 'Paper-2H', 2021), markSchemeUrl: msUrl('Chemistry', 'Paper-2H', 2021) },
  { id: 'chem-2020-1h', subject: 'Chemistry', examBoard: 'AQA', year: 2020, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Chemistry', 'Paper-1H', 2020), markSchemeUrl: msUrl('Chemistry', 'Paper-1H', 2020) },
  { id: 'chem-2020-2h', subject: 'Chemistry', examBoard: 'AQA', year: 2020, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Chemistry', 'Paper-2H', 2020), markSchemeUrl: msUrl('Chemistry', 'Paper-2H', 2020) },

  // Physics
  { id: 'phys-2024-1h', subject: 'Physics', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Physics', 'Paper-1H', 2024), markSchemeUrl: msUrl('Physics', 'Paper-1H', 2024) },
  { id: 'phys-2024-2h', subject: 'Physics', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Physics', 'Paper-2H', 2024), markSchemeUrl: msUrl('Physics', 'Paper-2H', 2024) },
  { id: 'phys-2023-1h', subject: 'Physics', examBoard: 'AQA', year: 2023, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Physics', 'Paper-1H', 2023), markSchemeUrl: msUrl('Physics', 'Paper-1H', 2023) },
  { id: 'phys-2023-2h', subject: 'Physics', examBoard: 'AQA', year: 2023, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Physics', 'Paper-2H', 2023), markSchemeUrl: msUrl('Physics', 'Paper-2H', 2023) },
  { id: 'phys-2022-1h', subject: 'Physics', examBoard: 'AQA', year: 2022, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Physics', 'Paper-1H', 2022), markSchemeUrl: msUrl('Physics', 'Paper-1H', 2022) },
  { id: 'phys-2022-2h', subject: 'Physics', examBoard: 'AQA', year: 2022, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Physics', 'Paper-2H', 2022), markSchemeUrl: msUrl('Physics', 'Paper-2H', 2022) },
  { id: 'phys-2021-1h', subject: 'Physics', examBoard: 'AQA', year: 2021, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Physics', 'Paper-1H', 2021), markSchemeUrl: msUrl('Physics', 'Paper-1H', 2021) },
  { id: 'phys-2021-2h', subject: 'Physics', examBoard: 'AQA', year: 2021, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Physics', 'Paper-2H', 2021), markSchemeUrl: msUrl('Physics', 'Paper-2H', 2021) },
  { id: 'phys-2020-1h', subject: 'Physics', examBoard: 'AQA', year: 2020, session: 'June', paper: 'Paper 1H', questionPaperUrl: qpUrl('Physics', 'Paper-1H', 2020), markSchemeUrl: msUrl('Physics', 'Paper-1H', 2020) },
  { id: 'phys-2020-2h', subject: 'Physics', examBoard: 'AQA', year: 2020, session: 'June', paper: 'Paper 2H', questionPaperUrl: qpUrl('Physics', 'Paper-2H', 2020), markSchemeUrl: msUrl('Physics', 'Paper-2H', 2020) },

  // Business
  { id: 'biz-2024-1', subject: 'Business', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 1', questionPaperUrl: 'https://cdn.sanity.io/files/p28bar15/green/f7021003484ad929dd7942e1b39ab827ae0997dd.pdf', markSchemeUrl: 'https://cdn.sanity.io/files/p28bar15/green/7098b0e5993efee405f0334748b05712ae866a2c.pdf' },
  { id: 'biz-2024-2', subject: 'Business', examBoard: 'AQA', year: 2024, session: 'June', paper: 'Paper 2', questionPaperUrl: 'https://cdn.sanity.io/files/p28bar15/green/6f9882f9df8a577806426bbf157ebb0895f89570.pdf', markSchemeUrl: 'https://cdn.sanity.io/files/p28bar15/green/0c2448f250ddcb8f46caaefb65ecc5d7febd14f2.pdf' },
];

export const SUBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  Biology: { bg: '#D1FAE5', text: '#065F46' },
  Chemistry: { bg: '#DBEAFE', text: '#1E40AF' },
  Physics: { bg: '#FEF3C7', text: '#92400E' },
  Business: { bg: '#EDE9FE', text: '#5B21B6' },
};
