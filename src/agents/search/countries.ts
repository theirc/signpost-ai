
export const countriesList = [
  {
    value: 1,
    label: "Galifrey",
    url: "https://signpost-test.vercel.app"
  },
  {
    value: 2,
    label: "Greece",
    url: "https://greece.refugee.info"
  },
  {
    value: 3,
    label: "Italy",
    url: "https://italy.refugee.info"
  },
  {
    value: 4,
    label: "Iraq",
    url: "https://www.simaetbhatha.com"
  },
  {
    value: 5,
    label: "Honduras",
    url: "https://honduras.cuentanos.org"
  },
  {
    value: 6,
    label: "El Salvador",
    url: "https://elsalvador.cuentanos.org"
  },
  {
    value: 7,
    label: "Guatemala",
    url: "https://guatemala.cuentanos.org"
  },
  {
    value: 8,
    label: "Jordan",
    url: null
  },
  {
    value: 9,
    label: "Colombia",
    url: "https://www.infopalante.org/es"
  },
  {
    value: 10,
    label: "Mexico",
    url: "https://www.infodigna.org"
  },
  {
    value: 11,
    label: "Pakistan",
    url: "www.infoyahan.org/"
  },
  {
    value: 12,
    label: "Niger",
    url: "https://www.sheega.info"
  },
  {
    value: 13,
    label: "Kenya",
    url: "https://julisha.info"
  },
  {
    value: 14,
    label: "United States",
    url: "https://www.importami.org/"
  },
  {
    value: 15,
    label: "Afghanistan",
    url: "https://www.beporsed.org"
  },
  {
    value: 17,
    label: "Tanzania and Burundi",
    url: null
  },
  {
    value: 18,
    label: "Ecuador",
    url: "https://www.infopalanteec.org/es"
  },
  {
    value: 19,
    label: "Hungary",
    url: "https://hungary.refugee.info"
  },
  {
    value: 20,
    label: "Czechia",
    url: "https://czechia.refugee.info"
  },
  {
    value: 21,
    label: "Bangladesh",
    url: "https://infosheba.org/"
  },
  {
    value: 23,
    label: "New York City",
    url: "https://signpost-monorepo-documented-nyc.vercel.app/"
  },
  {
    value: 24,
    label: "Uganda",
    url: "https://www.tubulire.info/"
  },
  {
    value: 25,
    label: "Thailand",
    url: "https://www.infotadar.info/"
  },
  {
    value: 26,
    label: "Libya",
    url: "https://www.malomat.org/"
  },
  {
    value: 27,
    label: "Nigeria",
    url: "https://www.gidanbayani.info/"
  },
  {
    value: 28,
    label: "Mali",
    url: "https://www.anourainfo.org/"
  },
  {
    value: 29,
    label: "Burkina Faso",
    url: "https://www.kibaruinfo.org/fr"
  },
  {
    value: 30,
    label: "Yemen",
    url: null
  },
  {
    value: 32,
    label: "Peru",
    url: "https://info-palante-peru.vercel.app/es"
  },
  {
    value: 33,
    label: "Sudan",
    url: "https://www.kadenafham.info/"
  },
  {
    value: 34,
    label: "Dominican Republic",
    url: "https://www.bocabouch.info/"
  },
  {
    value: 35,
    label: "Poland",
    url: null
  },
  {
    value: 36,
    label: "Ukraine",
    url: null
  },
  {
    value: 37,
    label: "Moldova",
    url: null
  },
  {
    value: 38,
    label: "Germany",
    url: null
  },
  {
    value: 39,
    label: "Syria",
    url: "https://www.andak-khabar.info/"
  },
  {
    value: 40,
    label: "Test country",
    url: null
  },
  {
    value: 41,
    label: "Washington Immigrant Information Center",
    url: "https://www.wa-immigrant.info/"
  }
]




export const idToDomain = countriesList.reduce((acc, curr) => {
  {
    acc[curr.value] = `services_${curr.value}`
    return acc
  }
}, {} as Record<number, string>)


export const domainToId = countriesList.reduce((acc, curr) => {
  {
    acc[`services_${curr.value}`] = curr.value
    return acc
  }
}, {} as Record<string, number>)

export const domainToLabel = countriesList.reduce((acc, curr) => {
  {
    acc[`services_${curr.value}`] = curr.label
    return acc
  }
}, {} as Record<string, string>)

export const domainToUrl = countriesList.reduce((acc, curr) => {
  {
    acc[`services_${curr.value}`] = curr.url
    return acc
  }
}, {} as Record<string, string>)