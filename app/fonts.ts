import localFont from 'next/font/local'

export const unzialish = localFont({
  src: '../public/fonts/Unzialish.ttf',
  variable: '--font-unzialish',
  display: 'swap',
})

export const alchemist = localFont({
  src: '../public/fonts/AlchemistSerifFont-Regular.ttf',
  variable: '--font-alchemist',
  display: 'swap',
}) 

export const cryuncial = localFont({
  src: [
    {
      path: '../public/fonts/CryUncial.ttf',
      style: 'normal',
    },
    {
      path: '../public/fonts/CryUncialItalic.ttf',
      style: 'italic',
    },
    {
      path: '../public/fonts/CryUncialCondensed.ttf',
      style: 'normal',
      weight: '300',
    },
  ],
  variable: '--font-cryuncial',
  display: 'swap',
}) 

export const celticknots = localFont({
  src: '../public/fonts/CelticKnots.ttf',
  variable: '--font-celticknots',
  display: 'swap',
}) 

export const quillsword = localFont({
  src: [
    {
      path: '../public/fonts/QuillSword.otf',
      style: 'normal',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordItalic.otf',
      style: 'italic',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordBoldItalic.otf',
      style: 'italic',
      weight: '700',
    },
    {
      path: '../public/fonts/QuillSwordLight.otf',
      style: 'normal',
      weight: '300',
    },
    {
      path: '../public/fonts/QuillSwordLightItalic.otf',
      style: 'italic',
      weight: '300',
    },
    {
      path: '../public/fonts/QuillSwordLeftalic.otf',
      style: 'italic',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordExpanded.otf',
      style: 'normal',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordExpandedItalic.otf',
      style: 'italic',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordCondensed.otf',
      style: 'normal',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordCondensedItalic.otf',
      style: 'italic',
      weight: '400',
    },
    {
      path: '../public/fonts/QuillSwordOutline.otf',
      style: 'normal',
      weight: '400',
    },
  ],
  variable: '--font-quillsword',
  display: 'swap',
})

export const quickquill = localFont({
  src: '../public/fonts/QuickquillRegula.ttf',
  variable: '--font-quickquill',
  display: 'swap',
})

export const luminari = localFont({
  src: '../public/fonts/Luminari-Regular.ttf',
  variable: '--font-luminari',
  display: 'swap',
})

export const gorckhelozat = localFont({
  src: '../public/fonts/GorckHelozatTrialRegular.ttf',
  variable: '--font-gorckhelozat',
  display: 'swap',
})

export const mysticora = localFont({
  src: '../public/fonts/DsMysticora.ttf',
  variable: '--font-mysticora',
  display: 'swap',
}) 