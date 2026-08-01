import type { Translations } from "../index";

//Portuguese (Portugal) locale.
export const pt: Translations = {
  cardName: "Helios",
  cardDescription:
    "☀️ Uma vista 2.5D em tempo real da tua casa com o sol, o tempo, a produção solar, a bateria e a rede, além de sombras projetadas e uma linha temporal interativa",

  period: {
    rangeLabel: "Período",
    forecast: "Previsão",
    yesterday: "Ontem",
    today: "Hoje",
    week: "Semana",
    month: "Mês",
    year: "Ano",
  },

  compass: "N,NE,E,SE,S,SO,O,NO",

  cloudCover: {
    cloudLow: "Nebulosidade baixa",
    cloudMid: "Nebulosidade média",
    cloudHigh: "Nebulosidade alta",
  },

  mapConfig: {
    section: "Configuração do mapa",
    intro:
      "O mapa de base é desenhado a partir de tiles vetoriais do OpenStreetMap. Auto segue o teu tema, Dark / Light forçam um deles, e Custom permite definir cada cor e ocultar qualquer camada.",
    modeAuto: "Auto",
    modeDark: "Escuro",
    modeLight: "Claro",
    modeCustom: "Personalizado",
    land: "Fundo",
    water: "Água",
    wood: "Zonas arborizadas",
    grass: "Espaços verdes",
    sand: "Areia",
    wetland: "Zonas húmidas",
    ice: "Gelo e neve",
    landuse: "Zonas edificadas",
    roadMajor: "Vias principais",
    roadMinor: "Vias secundárias",
    roadCasing: "Contorno das vias",
    path: "Caminhos e trilhos",
    rail: "Vias férreas",
    building: "Edifícios",
    boundary: "Limites",
  },

  editor: {
    locationSection: "Localização da casa",
    homeLatitude: "Latitude de casa",
    homeLongitude: "Longitude de casa",
    locationHint:
      "Substitui o endereço de casa usado como centro do cartão. Deixa ambos os campos vazios para usar a casa configurada no Home Assistant. A substituição só é aplicada quando AMBOS os campos contêm coordenadas válidas.",
    uiAndMapSection: "UI",
    autoRotate: "Rotação automática da câmara",
    autoRotateHint:
      "Após alguns segundos de inatividade, a câmara orbita lentamente em torno da casa (cerca de 1.5°/s, no sentido oposto ao movimento aparente do sol). Um arrasto com um dedo pausa-a de imediato e retoma assim que largares. Evita em dispositivos muito antigos: a rotação automática força um render a cada segundo.",
    autoRotateOn: "Ativada",
    autoRotateOff: "Desativada",
    dataDisplaySection: "Apresentação de dados",
    maxExpectedPower: "Potência máxima esperada",
    maxExpectedPowerHelp:
      "A potência à qual um fluxo anima à velocidade máxima. Cada fluxo é medido face a esta única referência, por isso um fluxo maior aparece sempre mais rápido do que um menor, seja qual for o sentido em que corre. Aumenta-a para uma instalação grande, baixa-a para uma pequena. Predefinição 5000 W.",
    sunChipMode: "Leitura do chip do sol",
    sunChipModeHelp:
      "O que o chip do sol mostra: a irradiância solar ao vivo (predefinição) ou a posição do sol (azimute e elevação). A posição não precisa de sensor, vem dos próprios cálculos solares do cartão.",
    sunChipModeIrradiance: "Irradiância",
    sunChipModePosition: "Posição do sol",
    displayUpdateFrequency: "Detalhe do gráfico",
    displayUpdateFrequencyHelp:
      "Quantos pontos por hora os gráficos desenham. Os dados em si são sempre as estatísticas de 5 minutos do Home Assistant; isto só controla a densidade com que a curva é traçada: 1 = um ponto por hora (a mais suave, a mais leve de renderizar), 6 = um ponto a cada 10 minutos (detalhe máximo, a mais pesada). Predefinição 4 = um ponto a cada 15 minutos. Baixa-o em dispositivos antigos ou lentos para reduzir o custo de renderização. A curva de previsão segue a mesma cadência, por isso uma definição mais fina também revela as quedas curtas de sombra (uma árvore que corta a produção durante meia hora) que uma curva horária ignora.",
    valueDecimals: "Decimais",
    valueDecimalsHelp:
      "Número de decimais mostrado em cada leitura de valor, para que os chips fiquem uniformes. Aplica-se aos valores em kW (os watts inteiros mantêm-se sem decimais) e aos kWh. De 0 a 3, predefinição 1.",
    powerUnit: "Unidade de potência",
    powerUnitHelp:
      "Unidade para cada leitura de potência no cartão (chips, dicas do gráfico). A energia também a segue, para que o cartão se mantenha consistente: kW combina com kWh, W com Wh.",
    irradianceUnit: "Unidade da constante solar",
    irradianceUnitHelp:
      "Unidade para a leitura da constante solar (irradiância) acima do sol.",
    batterySign: "Sinal da bateria",
    batterySignHelp:
      "Sinal mostrado no chip da bateria. A predefinição é menos ao carregar e mais ao descarregar. Invertido troca os dois. Oculto mostra o valor sem sinal.",
    batterySignDefault: "Predefinição",
    batterySignInverted: "Invertido",
    batterySignHidden: "Oculto",
    noUiMode: "Modo sem interface",
    noUiModeHint:
      "Esbate a linha temporal e os controlos do cartão após alguns segundos de inatividade. Qualquer toque ou movimento trá-los de volta. Ótimo para um ecrã de parede.",
    noUiDelay: "Atraso de inatividade antes de ocultar",
    noUiDelayHint:
      "Segundos de inatividade antes de a linha temporal e os controlos se esbaterem no modo sem interface. 0 mantém a interface oculta permanentemente. Usado apenas quando o modo sem interface está ativo.",
    showTimeline: "Mostrar linha temporal",
    showTimelineHint:
      "Mostra a linha temporal e o seletor de período por baixo da cena. Desativado, mantém apenas a cena.",
    showDetailPanel: "Mostrar informação adicional",
    showDetailPanelHint:
      "Permite que o mini-painel por chip (métricas agregadas) se abra no canto superior direito ao tocar num chip. Desativado, nunca é mostrado.",
    showSunTimes: "Mostrar horas do nascer / pôr do sol",
    showSunTimesHint:
      "Mostra as horas do nascer e do pôr do sol e os respetivos marcadores na base do arco solar.",
    lockRotation: "Bloquear rotação",
    lockRotationHint:
      "Define o ângulo de visualização diretamente na pré-visualização (arrasta para rodar e inclinar a cena) e depois ativa o bloqueio para o fixar: o arrastar para rodar e a auto-orbita em inatividade ficam desativados, mantendo o ângulo definido.",
    chipsSection: "Apresentação de entidades",
    chipsIntro:
      "Mostra ou oculta cada entidade, e escolhe o seu ícone e cor. A casa segue o chip selecionado, ou a tua cor primária por predefinição.",
    chipIrradiance: "Apresentação da irradiância",
    chipProduction: "Apresentação da produção",
    chipGrid: "Apresentação da rede",
    chipBattery: "Apresentação da bateria",
    chipHome: "Apresentação do consumo da casa",
    groupsConfigTitle: "Configuração de grupos",
    optionalSensors: "Sensores opcionais",
    solarIrradianceEntity: "Entidade de irradiância solar",
    solarIrradianceEntityHelp:
      "Escolhe um sensor que reporte a irradiância global de onda curta em W/m² (típico de estações Ecowitt / Davis / meteorológicas pessoais). Quando definido, o seu estado atual e o histórico do recorder substituem o Open-Meteo para a irradiância ao vivo e passada em todo o lado onde aparece (número no chip do sol, eixo Y do gráfico FV, coloração do arco solar). As horas de previsão continuam no Open-Meteo, já que um sensor não pode ter valores futuros.",
    liveDataTitle: "Estado da configuração",
    liveDataIntro:
      "Os chips ao vivo mostram apenas sensores medidos. Cada família precisa do sensor de potência ao vivo opcional da respetiva fonte no dashboard de Energia; as curvas e totais vêm sempre dos teus contadores.",
    liveSolarOk: "Solar: sensor de potência ao vivo detetado.",
    liveSolarMissing:
      "Solar: sem sensor de potência ao vivo, o chip de produção mantém-se oculto. Adiciona um em Definições > Painéis > Energia > Painéis solares.",
    liveSolarAbsent:
      "Solar: não configurado no teu dashboard de Energia. Adiciona painéis solares lá para obteres o chip de produção.",
    liveGridOk: "Rede: sensor de potência ao vivo detetado.",
    liveGridMissing:
      "Rede: sem sensor de potência ao vivo, os chips de importação/exportação mantêm-se ocultos. Adiciona um em Definições > Painéis > Energia > Rede.",
    liveGridMiswired:
      "Rede: o sensor de potência ao vivo contradiz os teus contadores (parece medir apenas um sentido). Os chips mantêm-se ocultos; configura um sensor com sinal ou o modo Dois sensores.",
    liveGridAbsent:
      "Rede: não configurada no teu dashboard de Energia. Adiciona a rede lá para obteres os chips de importação e exportação.",
    liveBatteryOk:
      "Bateria: sensores de potência ao vivo cobrem todas as baterias.",
    liveBatteryMissing:
      "Bateria: falta potência ao vivo em pelo menos uma bateria, o chip de potência mantém-se oculto. Adiciona o(s) sensor(es) de potência em Definições > Painéis > Energia > Bateria.",
    liveBatteryAbsent:
      "Bateria: não configurada no teu dashboard de Energia. Adiciona uma bateria lá para obteres o chip de carga e descarga.",
    liveHomeOk:
      "Consumo da casa: mostrado, derivado das famílias ao vivo acima.",
    liveHomeNote:
      "Consumo da casa: aparece assim que cada família configurada acima tiver o seu sensor ao vivo.",
    openEnergyConfig: "Abrir configuração de Energia",
    buildingsSection: "Casa e edifícios",
    buildingsHint:
      'Para manter o cartão fluido em zonas urbanas densas, só os edifícios dentro do raio configurado à volta da casa são renderizados em 3D. A casa em si mantém-se a opacidade total; os edifícios próximos são renderizados com a opacidade configurada para darem contexto urbano sem competir com as camadas de dados. O raio de agrupamento junta os anexos contíguos (varandas, garagens, alpendres) no grupo "casa".',
    displayRadius: "Raio de apresentação",
    displayRadiusHelp:
      "Raio à volta da casa no qual os edifícios são obtidos e desenhados, até à margem do disco do mapa esbatido. Baixa-o para aliviar a renderização num dispositivo lento; 0 mostra apenas a casa.",
    buildingCount: "Número de edifícios",
    buildingCountHelp:
      "Número máximo de edifícios próximos a desenhar. Baixa-o para aliviar a renderização num dispositivo lento.",
    buildingRealSize: "Alturas reais dos edifícios",
    buildingRealSizeOn: "Sim",
    buildingRealSizeOff: "Não",
    buildingRealSizeHint:
      "Sim: usa as alturas reais do OpenStreetMap (limitadas para manter um enquadramento legível). Não: dá a cada edifício a mesma altura fixa abaixo.",
    buildingHeight: "Altura dos edifícios",
    hiddenDevicesEmpty:
      "Ainda não há dispositivos individuais monitorizados no teu dashboard de Energia. Adiciona lá o consumo por dispositivo para os controlares aqui.",
    deviceVisibilityLabel: "Mostrar dispositivo",
    deviceGroupLabel: "Grupo de monitorização",
    group: "Grupo",
    noGroup: "Sem grupo",
    groupAssignHint:
      "Arraste os seus dispositivos para um grupo. O que ficar em baixo não pertence a nenhum grupo.",
    groupDropHere: "Largue aqui um dispositivo",
    backToLive: "Voltar ao direto",
    devicesEnergyNote:
      "Estes são os dispositivos individuais atualmente configurados no teu dashboard de Energia do Home Assistant. O olho mostra ou oculta cada um em todo o lado, e a pastilha atribui-o a um grupo.",
    buildingClusterRadius: "Raio de agrupamento da casa",
    buildingClusterRadiusHelp:
      "Raio à volta da casa dentro do qual os anexos contíguos (varandas, garagens, alpendres) são tratados como parte da casa: são renderizados com a opacidade e cor totais da casa em vez de vizinhos esbatidos. 0 mantém apenas o edifício principal.",
    buildingOpacity: "Opacidade dos edifícios envolventes",
    buildingColor: "Cor dos edifícios",
    buildingColorHelp:
      "Tom de base aplicado aos edifícios envolventes na cena.",
    shadowsSection: "Sombras",
    shadowsEnabled: "Mostrar sombras",
    shadowsEnabledOn: "Mostradas",
    shadowsEnabledOff: "Ocultas",
    shadowsEnabledHint:
      "Ativa ou oculta as sombras projetadas no solo pelos edifícios à medida que o sol se move.",
    shadowOpacity: "Opacidade das sombras",
    shadowOpacityHint: "Opacidade das sombras projetadas no solo.",
    resetSection: "Repor",
    resetSectionHint:
      "Ferramentas de manutenção: obter de novo os dados em cache do cartão, ou repor todas as opções para os valores predefinidos.",
    resetCacheButton: "Repor a cache de dados",
    resetCacheWarning:
      "Atenção: isto obtém de novo tudo o que o cartão tem em cache: o tempo do Open-Meteo, todas as séries de energia em memória (produção, rede, bateria, dispositivos, irradiância), a calibração da previsão afinada, e as pegadas de edifícios do OpenFreeMap, para todos os cartões Helios abertos nesta página. Usa isto para limpar uma calibração encravada ou dados de tempo/mapa desatualizados; uma obtenção completa demora alguns minutos consoante o teu servidor HA. Os teus dados dentro do Home Assistant nunca são tocados.",
    resetCacheDone: "Cache limpa ✓",
    resetOptionsButton: "Repor opções para as predefinições",
    resetOptionsConfirm: "Clica novamente para confirmar",
    resetOptionsWarning:
      "Atenção: isto repõe TODAS as opções deste cartão para os valores predefinidos: visibilidade, cores e ícones dos chips, nomes/cores/ícones dos grupos, edifícios, sombras, unidades e todas as outras definições. Os teus dados do Home Assistant e o dashboard de Energia não são tocados, mas a tua personalização é apagada e não pode ser recuperada.",
    resetOptionsDone: "Opções repostas ✓",
    aboutSection: "Sobre",
    aboutVersionLabel: "Versão",
    aboutRepoCard: "Helios",
    aboutCoffeeMessage:
      "Construo o Helios sozinho, sobretudo à noite, à procura dos pequenos detalhes até o sol e a tua energia ganharem vida no ecrã. Se ele encontrou um lugar no teu dashboard, isso já me deixa feliz; uma estrela no GitHub ainda mais, e um café mantém tudo isto a andar para a frente.",
    aboutDeveloperLabel: "Programador",
    aboutDeveloperLinkedIn: "LinkedIn",
    aboutCoffeeLink: "Buy me a coffee",
  },
};
