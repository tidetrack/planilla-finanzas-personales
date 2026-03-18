# Retomar el proyecto. 
Gemini, como estas? Hace tiempo que no hablamos. 
Estoy retomando este proyecto con antigravity porque lo dejé un poco abandonado. Claramente me pasó el problema de cualquier vibecoder. Conocí antigravity y creí que podría hacer todo lo que quisiese. Bueno, quise implementar toda mi sabiduría de google sheets para armar una planilla de finanzas personal que básicamente era una aplicación web. 
Ahora, vengo con otra cabeza. Quiero volver mas a los principios. Quiero que nos enfoquemos mucho mas en armar las BD y que estas sirvan para ejecutar ciertas fórmulas que nos permitan crear funcionalidades que sean CLAVE para la gestión de finanzas personales.  
Por ello, me di cuenta que complejicé de mas un proyecto que su fin es el de simplificar la vida a las personas. Teniendo en cuenta todo este contexto, te comento cual es mi propuesta de trabajo:

## Plan de cuentas centralizado
En primer lugar, Vamos a simplificar muchísimo el tema de las bases de datos y las vamos a hacer mas "integrales", es decir, no necesitamos tanto "metadato". Es importante tener variables bien definidas, pero no hace falta que sea tan compleja la cuestión. Para ello, se me ocurrió que podríamos hacer una Hoja de cálculo que sea emule un "plan de cuentas" Para que, si bien existan popups que hagan el ABM (agregar, borrar y/o modificar) de las cuentas, este plan de cuentas sea visible, relacionable y escalable. 
### Características de este plan de cuentas.
- Vamos a mapear cada columna de esta hoja, para que vos en tu memoria tengas esa arquitectura y podamos luego, hacer la correcta referencia a cualquier tipo de fórmula de google sheets que necesitemos. 

## Ingeniería del sheets
La idea es mapear cada hoja de calculo al 100%. Esto nos va a permitir entender la lógica de cada hoja y poder hacer la correcta referencia a cualquier tipo de fórmula de google sheets que necesitemos. Esto nos permite entender la integridad e idea de "sistema vivo" que entiende tus finanzas. 

## Pensando en la escalabilidad
Poder tener mapeado todo esto en antigraivity, nos va a permitir entender y crear esta planilla muy rápidamente. Podemos vincularte con Google Stich para la generación de tableros financieros y vos vas a poder crearlos, vas a entender de donde sacar la información y vas a poder ejecutar el appscript para que se creen automáticamente. 

Pero esto lo es todo. También, vas a poder entender cómo buscar información para que no solo creemos la planilla, sino tambien que la puedas interpretar. Esto podemos analizarlo y pensarlo como un plus que un cliente puede contratar para recibir informes semanales, trimestrales, anuales de cómo estan tus finanzas, cómo es tu comportamiento y cuales podrían ser tus metas financieras. 

## Sistema Modular
QUiero que este sistema esté pensado para que cada "hoja" sea una hoja independiente de todo el resto. Es decir, que funcione de modo modular nos permite el día de mañana agregar "extensiones" que nos permitan analizar y medir distintas cosas. Es como que vamos a ir armando "DLCs" de nuestra planilla financiera como aportes de valor estratégicos. Los módulos que serán básicos son: Plan de cuentas (sistema centralizado de cuentas), Hoja de cargas (registro de información), hoja Anual (información reducida, interpretación evolutiva), Hoja de Presupuestación (para la estrategia en el armado de tu flujo de fondos para afrontar tu próximo mes), panel general (visualización de cuentas en columnas, flujos de fondos, ahorros acumulados y control del presupuesto elaborado) y hoja de base de datos (donde se almacenen todas las bases de datos necesarias. Todas en una sola hoja para concentrar toda la información en un solo lugar)

### Ideas a guardar para el futuro
- Módulo de análisis de tarjetas de crédito (simulación de cuotas, cálculo de servicios contratados, cálculo de disponibilidades)
- Módulo de análisis de préstamos (cuotas, análisis del costo financiero total, etc)
- Módulo de Ahorros: Pensado para ponerse objetivos y medir cumplimiento de los mismos. (No solo en temrinos monetarios, sino también en análisis de indicadores)
- Módulo de flujo de fondos
- Módulo de glosario en donde expliquemos los indicadores y hablemos de los KPIs que se muestran en el panel o en futuros módulos. 

## Claude code
Es probable que pronto contrate claude code y este nos va a ayudar a hacer integraciones locas con lo que podemos hacer en este proyecto. Básicamente pensemos en hacerlo escalable para que en este futuro no tan lejano, Claude Code también pueda entender la planilla, la documentación interna de la planilla que va a armar a través de un repositorio. Para documentar exactamente cómo va funcionando la planilla. Esta aplicación pueda leer toda esa documentación para crear automatizaciones o integraciones con, por ejemplo, cotizaciones en tiempo real, carteras de inversión, APIs para distintas plataformas financieras y además para el armado de estos informes. semanales trimestrales y anuales que podemos hacer o interpretar a través de la inteligencia artificial.

## Investigación en profundidad de las Skills Necesarias
Además, te voy a pasar algunos links para que investigues aquellas skills o habilidades que deberías tener para poder lograr estas funciones y el armado de esta planilla por motus propia. Es decir, si ves que tenés problemas al codificar, si ves que tenés problemas al entender la información o al crear la documentación y el repositorio. es importante que puedas hacer investigaciones en profundidad sobre plataformas que se dedican a publicar skills gratuitas y buscar aquella que sea mejor para la resolución de este problema. 

## Preparación para GitHub
Este va a ser el primer proyecto que a su vez lo integremos con GitHub. Esto por una cuestión de también armado del repositorio de documentación y también para poder generar una historia y un repositorio que sea dinámico, vivo y sumamente utilizado respecto de cómo funciona la planilla, ya que esta planilla va a ser pensada para aquellas personas que le cuestan las finanzas personales y que quieran. aprender a ordenarse, pero también para aquellos que tengan más habilidades técnicas de programación y de cómo funciona el sistema, para poder hacerlo compatible con tal vez algunos análisis que quieran hacer. Pueden ir a este repositorio y entender cómo es este sistema, y para entender cómo este sistema es importante, el armado de esta documentación de funcionalidades. Validades, variables y sistemas modulares que expliquen cómo funcionan, cómo se integran las fórmulas. Básicamente, tener como un glosario de cómo está estructurada esta planilla financiera. 

## Pensando en el FrontEnd
la idea es que no te mates con el frontend y que sean claras las reglas para el armado de los dashboards automáticos, o que puedas entender también el display de los pop‑ups que vamos a tener dentro de esta planita. Todo esto también tiene que estar documentado y tiene que seguir esa rajatabla, es decir, tiene que ser clara y concisa, cuál es. es la bajada de línea de la marca y cómo utilizar los colores provistos por una paleta de colores para que no se preste a la interpretación, cómo manejar la creación de nuevas tablas, dashboards o nueva información. Es decir, vamos a dejar por escrito y fundamentado cómo se van a ver las tablas, cómo se van a ver los calendarios, cuál es la tipografía que se va a utilizar. utilizar: ¿cuáles van a ser los colores de fondo? ¿cuáles van a ser los colores de texto? ¿Cuáles son las celdas para mostrar botones? ¿Cuáles son las celdas para mostrar información? y donde se encuentra cada información en cada celda de cada obra. Básicamente, teniendo toda esta información podemos hacer que el armado de módulos nuevos sea escalable realmente. 

## Skills 

- https://skillsmp.com/

Te acabo de pasar una página web donde hay agentes o skills para proyectos e inteligencias artificiales como esta que estamos usando en Anthropic. Este link lo vas a guardar y acá es donde vas a tener en cuenta todo lo necesario para todas las habilidades que requerimos y para que esto funcione. Por ejemplo, necesitamos una skill que sea. Un agente que entienda cómo es el armado de los MSP para, por ejemplo, conectarnos con GitHub y conectarnos con cualquier otra herramienta, por ejemplo, Mails, Drive, Calendar, etc. Agentes que entiendan toda la lógica y ecosistema de integraciones de Google, por ejemplo. Por ejemplo, a gente que entienda el. github y que sepan documentar y registrar todo el repositorio y el glosario que quiero armar, y etcétera. Esto lo necesitamos crear para poder hacer que realmente tengamos varios agentes a la vez, que vayan haciendo distintas tareas. 

## Relevamiento de información
Una de las primeras cosas que tenemos que hacer también es el tema del relevamiento de información de la disposición de absolutamente todo lo que tengamos en la planilla actualmente. Esto básicamente va a ser tanto en la planilla como también en los documentos adjuntados y elaborados en el código madre de este proyecto. Lo que hay que hacer es ver qué nos sirve y qué hay que reemplazar. Otra de las cosas que hay que hacer es la revisión de todas las bases de datos para simplificarlas y hacerlas más a prueba de balas o apto para todo público. Entonces eso es algo que es importante que entiendas para también priorizar la información a la hora de realizar todas tus tareas. 

Este documento quiero que sea almacenado para su cronología y para que puedas entender el relevamiento de información que hiciste. Marca un "hito" en la historia de este proyecto.
