// 1AM-24: Curated politicians — shared data module
// Single source of truth for the 17 politicians shown in onboarding (SAA-15)
// and the Politicians management screen.
//
// Each entry contains:
//   - name      : display name (also used as the unique key in followedPoliticians state)
//   - initials  : two-letter avatar initials
//   - party     : 'D' | 'R' | 'I'
//   - chamber   : 'Senate' | 'House'
//
// To add or remove politicians, edit only this file — both the onboarding
// pick screen and the Politicians tab will pick up the change automatically.

export const CURATED_POLITICIANS = [
  { name: 'Richard Blumenthal',       initials: 'RB', party: 'D', chamber: 'Senate' },
  { name: 'John Boozman',             initials: 'JB', party: 'R', chamber: 'Senate' },
  { name: 'Shelley Moore Capito',     initials: 'SM', party: 'R', chamber: 'Senate' },
  { name: 'Dan Crenshaw',             initials: 'DC', party: 'R', chamber: 'House'  },
  { name: 'Ro Khanna',                initials: 'RK', party: 'D', chamber: 'House'  },
  { name: 'Angus King',               initials: 'AK', party: 'I', chamber: 'Senate' },
  { name: 'Michael McCaul',           initials: 'MM', party: 'R', chamber: 'House'  },
  { name: 'Morgan McGarvey',          initials: 'MM', party: 'D', chamber: 'House'  },
  { name: 'Nancy Pelosi',             initials: 'NP', party: 'D', chamber: 'House'  },
  { name: 'David Rouzer',             initials: 'DR', party: 'R', chamber: 'House'  },
  { name: 'Bernie Sanders',           initials: 'BS', party: 'I', chamber: 'Senate' },
  { name: 'Elise Stefanik',           initials: 'ES', party: 'R', chamber: 'House'  },
  { name: 'Tommy Tuberville',         initials: 'TT', party: 'R', chamber: 'Senate' },
  { name: 'Mark Warner',              initials: 'MW', party: 'D', chamber: 'Senate' },
  { name: 'Debbie Wasserman Schultz', initials: 'DW', party: 'D', chamber: 'House'  },
  { name: 'Roger Williams',           initials: 'RW', party: 'R', chamber: 'House'  },
  { name: 'Ron Wyden',                initials: 'RW', party: 'D', chamber: 'Senate' },
];
