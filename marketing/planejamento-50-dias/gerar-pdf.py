# -*- coding: utf-8 -*-
"""
Gera o planejamento de 50 dias de Instagram do BARBOS em PDF.

    python marketing/planejamento-50-dias/gerar-pdf.py

O conteúdo mora aqui embaixo (listas CARROSSEIS e MOTIONS). Mudou um post?
Edite o texto e rode de novo: o HTML é montado e impresso pelo Chrome
headless, igual ao manual de marca (identidade/gerar-pdf.py).
"""
import html
import os
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
SAIDA = os.path.join(AQUI, "planejamento-instagram-50-dias.pdf")
LOGO_ESCURO = os.path.join(RAIZ, "identidade", "logo", "barbos-horizontal-escuro.png")
LOGO_CLARO = os.path.join(RAIZ, "identidade", "logo", "barbos-horizontal-claro.png")

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

PILARES = {
    "A": ("Agenda", "A bagunça da agenda no caderno e no WhatsApp: horário duplicado, cliente que fura, horário vago, mensagem sem resposta."),
    "B": ("Dinheiro", "A falta de gestão financeira: não saber quanto entrou no mês, não saber a média de faturamento, dinheiro misturado, comissão no chute, produto que não foi cobrado."),
    "C": ("BARBOS na prática", "O sistema resolvendo cada dor, com telas reais: agenda, link de agendamento, comanda, loja do balcão, registro do dia e dashboard."),
    "D": ("Seridó", "Valorização da região: as barbearias e os negócios do Seridó vivem a mesma realidade, e o BARBOS é daqui, feito para quem é daqui."),
}

CAPITULOS = [
    (1, "O caderno", 1, 10, "Reconhecer a dor da agenda. A pessoa precisa se ver nos posts antes de ouvir falar de sistema."),
    (2, "A conta que não fecha", 11, 20, "Levar a conversa para o dinheiro: faturamento do mês, média, dinheiro misturado, comissão e produto esquecido."),
    (3, "Daqui do Seridó", 21, 30, "Criar laço com a região. Mostrar que o problema é de todo pequeno negócio daqui, e que a solução também pode ser daqui."),
    (4, "A virada", 31, 40, "Mostrar o BARBOS resolvendo, tela por tela, cada dor dos capítulos anteriores."),
    (5, "O mês que fecha", 41, 50, "Fechar a história: o dono que agora sabe a média, tem meta e não é pego de surpresa. Convite final."),
]

# ---------------------------------------------------------------------------
# CARROSSÉIS (dias ímpares)
# ---------------------------------------------------------------------------
CARROSSEIS = [
    dict(dia=1, pilar="A", seridó=False,
         titulo="Sua agenda cabe num caderno. Seu sábado, não.",
         slides=[
             "Capa: “Sua agenda cabe num caderno. Seu sábado, não.”",
             "O caderno aguenta a segunda-feira. No sábado, com fila na porta, ele começa a falhar.",
             "Rasura em cima de rasura. Um nome escrito por cima do outro. Quem marcou primeiro?",
             "O caderno ficou em casa. Molhou. Alguém levou para a outra cadeira.",
             "O cliente que mandou mensagem às 11h só recebe resposta às 15h, quando já cortou em outro lugar.",
             "Não é falta de esforço. É ferramenta pequena para um negócio que cresceu.",
             "Fecho: “Seu caderno ainda dá conta? Comenta SIM ou NÃO.”",
         ],
         legenda="O caderno foi o primeiro sócio de muita barbearia. Mas tem dia que ele não aguenta. Arrasta e vê se algum desses já aconteceu aí.",
         cta="Comentar SIM ou NÃO. Salvar o post."),
    dict(dia=3, pilar="A", seridó=False,
         titulo="5 sinais de que sua agenda está te custando dinheiro",
         slides=[
             "Capa: “5 sinais de que sua agenda está te custando dinheiro”",
             "1. O cliente perguntou horário no WhatsApp e você respondeu horas depois.",
             "2. Teve horário vago no meio da tarde e ninguém ficou sabendo.",
             "3. O cliente furou e a cadeira ficou parada esperando.",
             "4. Um encaixe atrasou todo o resto do dia.",
             "5. No fim do mês, você não sabe quantos cortes fez.",
             "Cada um desses é dinheiro que não entrou. E nenhum é culpa sua: é falta de ferramenta.",
             "Fecho: “Quantos desses aconteceram essa semana? Comenta o número.”",
         ],
         legenda="Agenda bagunçada não aparece como despesa, mas pesa no fim do mês. Quantos desses você reconhece?",
         cta="Comentar o número de sinais."),
    dict(dia=5, pilar="A", seridó=False,
         titulo="Horário vago também é prejuízo",
         slides=[
             "Capa: “Horário vago também é prejuízo”",
             "Cadeira parada não aparece em lugar nenhum. Nem no caderno, nem no Pix.",
             "Faz a conta com a gente (exemplo):",
             "2 horários vagos por dia × R$ 35 o corte = R$ 70 por dia.",
             "R$ 70 × 26 dias de trabalho = R$ 1.820 no mês.",
             "Troca pelos seus números. Assusta, né?",
             "Horário fica vago quando o cliente não sabe que ele existe. Com a agenda aberta para o cliente ver, ele é preenchido.",
             "Fecho: “Salva e faz a conta com o seu preço.”",
         ],
         legenda="Ninguém anota o dinheiro que deixou de entrar. Faz essa conta com o preço do seu corte e conta aqui se assustou.",
         cta="Salvar. Comentar quanto deu a conta.",
         nota="Os números são de exemplo: deixe a palavra “exemplo” escrita no slide."),
    dict(dia=7, pilar="A", seridó=False,
         titulo="Caderno x agenda no celular: o que muda no seu dia",
         slides=[
             "Capa: “Caderno x agenda no celular”",
             "Caderno: só quem está com ele sabe os horários. Celular: você e a equipe veem a agenda de qualquer lugar.",
             "Caderno: dois nomes no mesmo horário. Celular: o sistema avisa que o horário já está ocupado.",
             "Caderno: o cliente pergunta no WhatsApp e espera. Celular: o cliente vê os horários livres e marca sozinho.",
             "Caderno: telefone do cliente? Talvez. Celular: o telefone fica no cadastro.",
             "Caderno: fim do mês, ninguém sabe quanto entrou. Celular: o mês já está somado.",
             "O caderno não é inimigo. Ele só ficou pequeno.",
             "Fecho: “Qual dessas diferenças pesa mais no seu dia? Comenta.”",
         ],
         legenda="Não é sobre jogar o caderno fora. É sobre o que ele não consegue fazer por você.",
         cta="Comentar qual diferença pesa mais."),
    dict(dia=9, pilar="A", seridó=True,
         titulo="No Seridó, sábado é sagrado. Sua agenda está pronta pra ele?",
         slides=[
             "Capa: “No Seridó, sábado é sagrado. Sua agenda está pronta pra ele?”",
             "Aqui o povo deixa o cabelo para o sábado: para a feira, para o aniversário, para a festa da padroeira.",
             "E o sábado vira fila na porta, cliente esperando em pé e barbeiro sem almoço.",
             "Organizar o sábado começa na semana: quem já marcou e quais horários sobram.",
             "Dica: abra os horários do sábado com antecedência e deixe o cliente escolher. Quem marcou não precisa chegar cedo para pegar fila.",
             "Com horário marcado, o cliente chega na hora dele. E você sabe quem é o próximo.",
             "Fecho: “Qual o dia mais corrido da sua barbearia? Comenta.”",
         ],
         legenda="Sábado no Seridó é dia de sair bonito. Para a barbearia, é o dia que mais rende e o que mais bagunça.",
         cta="Comentar o dia mais corrido."),
    dict(dia=11, pilar="B", seridó=False,
         titulo="Quanto sua barbearia faturou mês passado?",
         slides=[
             "Capa: “Quanto sua barbearia faturou mês passado?” Subtítulo: “Se a resposta demorou, esse post é pra você.”",
             "Muito dono de barbearia sabe quanto custa o corte, mas não sabe quanto entrou no mês.",
             "Sem esse número, toda decisão vira chute: aumentar o preço, chamar outro barbeiro, comprar cadeira nova.",
             "E o mês bom esconde o mês ruim. Você só percebe quando a conta aperta.",
             "Saber o faturamento não é coisa de empresa grande. É saber se o seu trabalho está valendo a pena.",
             "Nos próximos posts, a gente mostra como descobrir a sua média.",
             "Fecho: “Você sabe esse número de cabeça? Responde SIM ou NÃO. Ninguém vai julgar.”",
         ],
         legenda="Pergunta simples, resposta difícil para muita gente. Começa aqui a conversa sobre o dinheiro da barbearia.",
         cta="Comentar SIM ou NÃO."),
    dict(dia=13, pilar="B", seridó=False,
         titulo="Média de faturamento: a conta que todo dono deveria saber",
         slides=[
             "Capa: “Média de faturamento: a conta que todo dono deveria saber”",
             "Um mês sozinho engana. Dezembro é cheio, fevereiro é curto. A média mostra o normal da sua barbearia.",
             "Como fazer: some o que entrou nos últimos 3 meses.",
             "Divida por 3. Esse é o seu faturamento médio.",
             "Exemplo: R$ 6.200 + R$ 5.400 + R$ 7.000 = R$ 18.600. Dividido por 3: R$ 6.200 por mês.",
             "Com a média você sabe quanto pode gastar, quanto guardar e quando um mês ficou abaixo do normal.",
             "O difícil não é a conta. É ter o número de cada mês. No caderno, ele se perde.",
             "Fecho: “Salva para fazer a conta no fim do mês.”",
         ],
         legenda="A média é o número mais útil que um dono de barbearia pode ter. E a conta é de 5ª série.",
         cta="Salvar. Compartilhar com o sócio.",
         nota="Valores de exemplo: escreva “exemplo” no slide 5."),
    dict(dia=15, pilar="B", seridó=False,
         titulo="Faturamento não é lucro",
         slides=[
             "Capa: “Faturamento não é lucro”",
             "Faturamento é tudo o que entrou: cortes, barbas, produtos vendidos.",
             "Lucro é o que sobra depois de pagar as contas da barbearia.",
             "As contas: aluguel, energia, água, produtos, comissão da equipe, taxa da maquininha.",
             "A conta simples: o que entrou, menos o que saiu, é o que sobrou.",
             "Sem saber o que entrou, a conta nem começa. Por isso o primeiro número é o faturamento.",
             "O BARBOS soma o que entrou no mês, com serviços e loja separados. Com esse número na mão, a conta do que sobra fica fácil.",
             "Fecho: “Você sabe quanto sobra no fim do mês? SIM, NÃO ou MAIS OU MENOS?”",
         ],
         legenda="Muita barbearia cheia fecha o mês apertada. Quase sempre é porque o faturamento foi confundido com o que sobra.",
         cta="Comentar SIM, NÃO ou MAIS OU MENOS.",
         nota="O BARBOS mostra o que ENTROU. Ele não controla contas a pagar: não diga que o sistema calcula o lucro."),
    dict(dia=17, pilar="B", seridó=False,
         titulo="O refrigerante que ninguém cobrou",
         slides=[
             "Capa: “O refrigerante que ninguém cobrou”",
             "O cliente cortou, pegou um refri na geladeira, conversou, pagou o corte e foi embora.",
             "O refri ficou para trás. Ninguém fez por mal. Só esqueceu.",
             "Agora multiplica: uma água aqui, um energético ali, uma pomada que ficou “pra pagar depois”.",
             "No fim do mês, o que sai da geladeira e não entra no caixa vira um buraco.",
             "Na comanda do BARBOS, o barbeiro lança o que o cliente consumiu junto com o serviço. Na hora de fechar, aparece o total.",
             "Falou o total em voz alta, recebeu o certo.",
             "Fecho: “Sua barbearia vende bebida ou produto? Comenta o que mais sai.”",
         ],
         legenda="Produto esquecido é o dinheiro mais fácil de perder e o mais fácil de recuperar.",
         cta="Comentar o produto que mais sai."),
    dict(dia=19, pilar="D", seridó=True,
         titulo="Seridoense não tem medo de trabalho. Tem medo de conta que não fecha.",
         slides=[
             "Capa: “Seridoense não tem medo de trabalho. Tem medo de conta que não fecha.”",
             "Aqui no Seridó, quem tem negócio trabalha de domingo a domingo. Abre cedo, fecha tarde.",
             "A barbearia, a padaria, o mercadinho, a oficina: quase todo mundo começou com um caderno.",
             "O caderno ajudou a crescer. Mas chega uma hora em que crescer exige saber os números.",
             "Quanto entrou, quanto saiu, qual mês foi melhor. É o que separa quem trabalha muito de quem trabalha muito e vê resultado.",
             "Organizar a barbearia é respeitar o próprio suor.",
             "Fecho: “Marca aqui um empreendedor do Seridó que você admira.”",
         ],
         legenda="Uma homenagem a quem faz o comércio do Seridó girar. Marca alguém que merece ver esse post.",
         cta="Marcar um empreendedor da região."),
    dict(dia=21, pilar="D", seridó=True,
         titulo="Feito no Seridó, pra quem é do Seridó",
         slides=[
             "Capa: “Feito no Seridó, pra quem é do Seridó”",
             "O BARBOS nasceu aqui, na mesma realidade das barbearias de Currais Novos, Caicó, Acari, Parelhas e região.",
             "A gente sabe como é: sábado cheio, cliente que chega sem marcar, fiado, WhatsApp que não para.",
             "Por isso o sistema foi feito simples. Para quem está saindo do caderno, não para especialista em tecnologia.",
             "Tecnologia não precisa vir de longe para ser boa. Pode nascer na esquina.",
             "Quando uma empresa daqui cresce, a região cresce junto.",
             "Fecho: “De qual cidade do Seridó você está vendo esse post? Comenta.”",
         ],
         legenda="Abre o capítulo sobre a nossa região. O BARBOS é daqui e quer ver as barbearias daqui crescendo.",
         cta="Comentar a cidade."),
    dict(dia=23, pilar="D", seridó=True,
         titulo="Padaria, mercadinho, oficina e barbearia: o mesmo caderno",
         slides=[
             "Capa: “Padaria, mercadinho, oficina e barbearia: o mesmo caderno”",
             "Em toda cidade do Seridó tem um comércio que funciona há anos no caderno.",
             "O fiado anotado na última página. A encomenda escrita no canto. O telefone do cliente que ninguém acha.",
             "Isso não é atraso. É o jeito que o pequeno negócio daqui aprendeu a sobreviver.",
             "Mas sobreviver é pouco. A gente quer ver os negócios daqui crescendo.",
             "Para a barbearia, o primeiro passo é a agenda e o mês somado. Simples, no celular.",
             "Fecho: “Compartilha com um amigo que tem comércio e ainda usa caderno.”",
         ],
         legenda="Negócios diferentes, a mesma realidade. Quem é do Seridó se reconhece.",
         cta="Compartilhar com um amigo comerciante."),
    dict(dia=25, pilar="D", seridó=True,
         titulo="Currais Novos acorda cedo",
         slides=[
             "Capa: “Currais Novos acorda cedo”",
             "Antes das 8h já tem barbearia de porta aberta e café passado.",
             "Cidade que cresceu com trabalho pesado sabe o valor de cada hora.",
             "E cada hora da cadeira vale dinheiro. Por isso a agenda importa.",
             "Esse post é uma homenagem aos barbeiros de Currais Novos, que fazem a cidade sair bonita no sábado.",
             "Organização não muda quem você é. Só faz o seu trabalho render mais.",
             "Fecho: “Marca aqui a barbearia que você frequenta em Currais Novos.”",
         ],
         legenda="Para os barbeiros de Currais Novos. Marca a sua barbearia e bora encher esses comentários.",
         cta="Marcar a barbearia que frequenta.",
         nota="Se quiser uma referência local no slide 3 (a história da scheelita e da Mina Brejuí, por exemplo), confira o fato antes de postar."),
    dict(dia=27, pilar="D", seridó=True,
         titulo="De qual cidade do Seridó é a sua barbearia?",
         slides=[
             "Capa: “De qual cidade do Seridó é a sua barbearia?”",
             "Currais Novos. Caicó. Acari. Parelhas. Jardim do Seridó. Carnaúba dos Dantas. Cruzeta. Jucurutu. São José do Seridó.",
             "Em cada uma tem barbeiro bom de tesoura, cliente fiel e sábado lotado.",
             "E em quase todas a agenda ainda é no caderno ou no WhatsApp.",
             "Queremos conhecer as barbearias da região: quem são, como trabalham, o que falta.",
             "Comenta a sua cidade e o nome da sua barbearia. Vamos montar esse mapa juntos.",
             "Fecho: “Comenta: cidade + barbearia.”",
         ],
         legenda="Vamos montar o mapa das barbearias do Seridó nos comentários. Os nomes que aparecerem aqui vão para os nossos stories.",
         cta="Comentar cidade e nome da barbearia.",
         nota="Use as respostas nos stories da semana (repostar com autorização) e como pauta para novos posts."),
    dict(dia=29, pilar="D", seridó=True,
         titulo="“Sistema é coisa de cidade grande” e outros mitos",
         slides=[
             "Capa: “‘Sistema é coisa de cidade grande’ e outros mitos”",
             "Mito 1: “Meu cliente não vai saber marcar pelo link.” Ele digita o telefone e escolhe o horário. Se já marcou antes, o nome aparece sozinho.",
             "Mito 2: “Preciso de computador.” Funciona no celular e dá para colocar na tela de início, como um aplicativo.",
             "Mito 3: “Vou ter que mudar tudo.” Não quer agenda? Anote no fim do dia quantos cortes cada barbeiro fez, e o mês se soma do mesmo jeito.",
             "Mito 4: “Barbearia pequena não precisa disso.” É a pequena que mais sente um horário vago ou um produto esquecido.",
             "Sistema bom é o que cabe na sua rotina, não o contrário.",
             "Fecho: “Qual desses você já pensou? Comenta o número.”",
         ],
         legenda="Muita gente do interior acha que sistema não é pra si. Vamos desmontar esses mitos um por um.",
         cta="Comentar o número do mito."),
    dict(dia=31, pilar="C", seridó=False,
         titulo="Do caderno para o celular: o passo a passo",
         slides=[
             "Capa: “Do caderno para o celular: o passo a passo”",
             "1. Cadastre seus serviços: nome, preço e quanto tempo dura.",
             "2. Cadastre a equipe, com o telefone de cada barbeiro.",
             "3. Diga os dias e os horários em que a barbearia abre.",
             "4. Copie o seu link de agendamento e coloque na bio do Instagram.",
             "5. Transforme o link num QR code e cole no balcão.",
             "Pronto: o cliente já pode marcar. O caderno pode ir para a gaveta.",
             "Fecho: “Salva para fazer com calma.”",
         ],
         legenda="Começar é mais simples do que parece. Salva esse passo a passo.",
         cta="Salvar o post.",
         nota="O BARBOS dá o link pronto; o QR code é feito a partir dele (qualquer gerador gratuito). Não diga que o sistema imprime o QR."),
    dict(dia=33, pilar="C", seridó=False,
         titulo="Cliente que já veio não precisa digitar o nome de novo",
         slides=[
             "Capa: “Cliente que já veio não precisa digitar o nome de novo”",
             "No link do BARBOS, o agendamento começa pelo telefone.",
             "Se o cliente já marcou antes na sua barbearia, o nome aparece sozinho. Ele só escolhe o horário.",
             "Primeira vez? Ele escreve nome e sobrenome uma vez só.",
             "Marcando para o filho? Tem o botão “Marcar para outra pessoa”.",
             "Para você: um telefone, um cliente. Sem cadastro repetido com o nome escrito de três jeitos.",
             "E na página aberta aparece só o primeiro nome e a inicial do sobrenome, para proteger seus clientes.",
             "Fecho: “Seus clientes marcam mais pelo WhatsApp ou pessoalmente? Comenta.”",
         ],
         legenda="Menos digitação para o cliente, cadastro organizado para você.",
         cta="Comentar como os clientes marcam hoje."),
    dict(dia=35, pilar="B", seridó=False,
         titulo="Sua equipe sabe quanto produziu no mês?",
         slides=[
             "Capa: “Sua equipe sabe quanto produziu no mês?”",
             "Na barbearia com mais de uma cadeira, a pergunta aparece: quem fez quanto?",
             "Sem número, a comissão vira desconfiança. E desconfiança derruba equipe.",
             "No Dashboard do BARBOS dá para filtrar por barbeiro: quanto cada um movimentou em serviços e na loja.",
             "Número claro deixa a conversa justa, para quem paga e para quem recebe.",
             "E ainda mostra quem está crescendo, para valorizar quem merece.",
             "Fecho: “Como você calcula a comissão hoje? Porcentagem, valor fixo ou outro jeito?”",
         ],
         legenda="Comissão boa é comissão que ninguém precisa discutir.",
         cta="Comentar como calcula a comissão."),
    dict(dia=37, pilar="C", seridó=False,
         titulo="Não quer usar agenda? Anote só o fim do dia",
         slides=[
             "Capa: “Não quer usar agenda? Anote só o fim do dia”",
             "Tem barbearia que trabalha por ordem de chegada e não quer mudar. Tudo bem.",
             "No fim do expediente, abra o Registro manual e diga quantos cortes, barbas e combos cada barbeiro fez.",
             "Saíram 12 energéticos? Anota também. O estoque baixa junto.",
             "O BARBOS soma tudo no Dashboard: quanto entrou no dia, no mês e por barbeiro.",
             "Você continua trabalhando do seu jeito. Só para de perder os números.",
             "Fecho: “Sua barbearia é por ordem de chegada ou hora marcada?”",
         ],
         legenda="Nem toda barbearia quer agenda. Toda barbearia precisa saber quanto entrou.",
         cta="Comentar: ordem de chegada ou hora marcada."),
    dict(dia=39, pilar="C", seridó=False,
         titulo="Nunca usei sistema. E agora?",
         slides=[
             "Capa: “Nunca usei sistema. E agora?”",
             "“Funciona no meu celular?” Funciona. Abre no navegador, e dá para colocar na tela de início.",
             "“Meu cliente mais velho consegue marcar?” Ele digita o telefone e escolhe o horário. Se preferir, você marca por ele na agenda.",
             "“Tenho que largar o caderno de uma vez?” Não. Dá para começar só registrando o fim do dia.",
             "“E se eu tiver mais de um barbeiro?” Cada um tem a sua agenda, e o cliente escolhe com quem quer cortar.",
             "“Consigo ver quanto entrou?” Sim: no Dashboard, por mês, por serviço e por barbeiro.",
             "Fecho: “Qual a sua dúvida? Deixa aqui que a gente responde todas.”",
         ],
         legenda="Dúvida de quem nunca usou sistema não é bobagem. Pergunta aqui.",
         cta="Comentar uma dúvida (responder todas)."),
    dict(dia=41, pilar="B", seridó=False,
         titulo="3 números para olhar todo mês",
         slides=[
             "Capa: “3 números para olhar todo mês”",
             "1. Quanto entrou: o total do mês, com serviços e loja.",
             "2. De onde veio: qual serviço mais saiu, qual produto mais vendeu.",
             "3. Como esse mês se compara: melhor ou pior que os anteriores? E que a sua média?",
             "Com esses três você decide preço, promoção, compra de estoque e meta.",
             "No BARBOS os três estão na mesma tela: o Dashboard.",
             "Fecho: “Salva e confere os seus no fim do mês.”",
         ],
         legenda="Três números, cinco minutos por mês. É o que separa o chute da decisão.",
         cta="Salvar o post."),
    dict(dia=43, pilar="B", seridó=False,
         titulo="O mês fraco não precisa ser surpresa",
         slides=[
             "Capa: “O mês fraco não precisa ser surpresa”",
             "Todo negócio tem mês mais fraco. Na barbearia não é diferente.",
             "O problema não é o mês fraco. É ser pego de surpresa por ele.",
             "Quem acompanha os meses vê o padrão: quando enche, quando esvazia.",
             "Aí dá para se preparar: guardar no mês forte, fazer uma ação no mês fraco, segurar a compra de estoque.",
             "Histórico é o que transforma surpresa em planejamento. E histórico só existe se o mês for registrado.",
             "Fecho: “Qual o mês mais fraco da sua barbearia? Comenta.”",
         ],
         legenda="Mês fraco anunciado não assusta. Comenta qual é o seu.",
         cta="Comentar o mês mais fraco."),
    dict(dia=45, pilar="A", seridó=False,
         titulo="Um sábado no caderno x um sábado organizado",
         slides=[
             "Capa: “Um sábado no caderno x um sábado organizado”",
             "8h. Caderno: fila na porta. Organizado: o primeiro cliente marcado está chegando.",
             "10h. Caderno: dois clientes no mesmo horário. Organizado: cada um na sua hora.",
             "12h. Caderno: WhatsApp acumulado. Organizado: os clientes marcaram pelo link.",
             "15h. Caderno: o cliente furou e ninguém tem o telefone. Organizado: o telefone está no cadastro.",
             "19h. Caderno: “acho que foi um dia bom”. Organizado: o dia está somado, com cada produto vendido.",
             "Fecho: “Qual dos dois parece mais com o seu sábado?”",
         ],
         legenda="Mesma barbearia, mesmo sábado, dois finais diferentes.",
         cta="Comentar: caderno ou organizado."),
    dict(dia=47, pilar="D", seridó=True,
         titulo="Barbearias do Seridó: vamos crescer juntos",
         slides=[
             "Capa: “Barbearias do Seridó: vamos crescer juntos”",
             "Esses dias foram sobre a nossa realidade: agenda no caderno, mês que não fecha, sábado lotado.",
             "Se você se viu em algum post, não está sozinho. Muita barbearia daqui vive o mesmo.",
             "O BARBOS foi feito para isso: simples, no celular, pensado para quem é daqui.",
             "Queremos ver as barbearias do Seridó organizadas, crescendo e valorizadas.",
             "Bora junto?",
             "Fecho: “Chama no direct com a palavra SERIDÓ que a gente te mostra o sistema funcionando.”",
         ],
         legenda="Um convite para as barbearias da nossa região.",
         cta="Mandar SERIDÓ no direct."),
    dict(dia=49, pilar="B", seridó=False,
         titulo="Qual dessas dores é a sua?",
         slides=[
             "Capa: “Qual dessas dores é a sua?”",
             "1. Cliente perguntando horário no WhatsApp o dia todo.",
             "2. Cliente que fura e some.",
             "3. Não saber quanto entrou no mês.",
             "4. Não saber a média de faturamento.",
             "5. Comissão no chute.",
             "6. Produto que sai da geladeira e não entra no caixa.",
             "Fecho: “Comenta o número da sua maior dor. A gente responde cada comentário com uma dica.”",
         ],
         legenda="Fechando a temporada com uma pergunta: qual é a sua maior dor hoje?",
         cta="Comentar o número (responder cada um com uma dica)."),
]

# ---------------------------------------------------------------------------
# MOTIONS (dias pares) — série “Na cadeira do Tonho”
# ---------------------------------------------------------------------------
MOTIONS = [
    dict(dia=2, ep=1, pilar="A", seridó=True,
         titulo="Sábado, 9h. Dois clientes. Um horário.",
         gancho="“Sábado, 9h. Dois clientes chegam para o mesmo horário.”",
         cenas=[
             "Apresentação: “Esse é o Tonho. Barbeiro há 15 anos em Currais Novos. Duas cadeiras e um caderno de capa azul.”",
             "O caderno aberto: dois nomes no mesmo horário, um escrito por cima do outro.",
             "Os dois clientes se olham. Tonho, sem graça: “Quem marcou primeiro?”",
             "Um deles vai embora. Na tela: “−1 corte”.",
             "Virada: “O problema não é o Tonho. É o caderno.”",
         ],
         fecho="“Série: Na cadeira do Tonho. Toda semana tem episódio.”",
         legenda="Começa hoje uma série inspirada na rotina de muita barbearia aqui do Seridó. O Tonho é personagem, mas essa história você conhece.",
         cta="Comentar “já” se já passou por isso."),
    dict(dia=4, ep=2, pilar="A", seridó=False,
         titulo="O WhatsApp não para",
         gancho="“Tesoura numa mão. Celular na outra.”",
         cenas=[
             "Tonho cortando; o celular vibrando no balcão. Contador de mensagens subindo: 3, 7, 12.",
             "Mensagem na tela, 11h02: “Tem horário hoje à tarde?”",
             "Ele só consegue responder às 14h40: “Tenho às 15h!” Resposta: “Já cortei, obrigado.”",
             "Texto: “Ele não perdeu o cliente por ser ruim. Perdeu por estar trabalhando.”",
             "Virada: “E se o cliente pudesse ver os horários livres sem precisar perguntar?”",
         ],
         fecho="“No próximo episódio…”",
         legenda="Quem responde WhatsApp cortando cabelo sabe: não tem mão para tudo.",
         cta="Responder: quantas mensagens de “tem horário?” você recebe por dia?"),
    dict(dia=6, ep=3, pilar="A", seridó=False,
         titulo="O cliente que furou",
         gancho="“Terça, 16h. A cadeira está pronta. O cliente não veio.”",
         cenas=[
             "Relógio na parede: 16h, 16h15, 16h30. Tonho olhando a porta.",
             "Ele procura o telefone no caderno: só tem escrito “Damião”.",
             "Texto: “Sem telefone, sem aviso, sem como remarcar.”",
             "16h40 chega outro cliente querendo encaixe, mas 40 minutos já se foram.",
             "Virada: “Um furo por dia, no fim do mês, vira horas de cadeira parada.”",
         ],
         fecho="“Agenda boa guarda o telefone de quem marcou.”",
         legenda="Furo acontece. O que não pode é não ter nem como ligar para o cliente.",
         cta="Contar como lida com quem fura."),
    dict(dia=8, ep=4, pilar="C", seridó=False,
         titulo="E se o cliente marcasse sozinho?",
         gancho="“22h. O Tonho já está em casa. O celular apita.”",
         cenas=[
             "Aviso na tela: “Novo agendamento: sábado, 9h, corte com Tonho.”",
             "Volta no tempo: o cliente abriu o link na bio, escolheu barbeiro, serviço e horário.",
             "Tela do link de agendamento (print da conta de teste) com os horários livres.",
             "Tonho sorri: “Ninguém me perguntou nada. E o horário está marcado.”",
             "Texto: “O link fica aberto 24 horas. A sua barbearia não precisa ficar.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Com o link de agendamento do BARBOS, o cliente vê os horários livres e marca sozinho, a qualquer hora. Você recebe o aviso no celular.",
         cta="Comentar: você deixaria o cliente marcar sozinho?"),
    dict(dia=10, ep=5, pilar="C", seridó=False,
         titulo="O QR na parede",
         gancho="“Um papel na parede que marca horário sozinho.”",
         cenas=[
             "Tonho cola um QR code ao lado do espelho.",
             "O cliente que espera a vez aponta a câmera e abre a página da barbearia.",
             "Escolhe “Cabelo + Barba”, sábado, 10h. Confirma.",
             "Na hora, ele vai para o WhatsApp do barbeiro com o recado pronto.",
             "Texto: “O QR é o mesmo link da bio, só que no papel.”",
         ],
         fecho="“Já viu isso numa barbearia daqui?”",
         legenda="O link de agendamento é fixo: não expira e não muda. Dá para pôr na bio, mandar no WhatsApp e imprimir como QR code.",
         cta="Comentar QR para receber um exemplo."),
    dict(dia=12, ep=6, pilar="B", seridó=False,
         titulo="“Tonho, quanto entrou esse mês?”",
         gancho="“Tonho, quanto entrou esse mês?”",
         cenas=[
             "A pergunta vem da Lúcia, esposa dele, no jantar.",
             "Tonho abre o caderno: páginas de nomes, nenhum total.",
             "Abre o app do banco: o Pix da barbearia misturado com a luz e o mercado.",
             "Abre a gaveta: dinheiro, comprovante, um vale de R$ 20.",
             "Ele responde: “Ah… deve ter dado uns 5 mil.” Na tela: “Deve ter dado.”",
         ],
         fecho="“‘Deve ter dado’ não paga boleto.”",
         legenda="A pergunta mais simples sobre um negócio é a mais difícil de responder sem os números.",
         cta="Comentar se já respondeu “deve ter dado”."),
    dict(dia=14, ep=7, pilar="B", seridó=False,
         titulo="O dinheiro que some",
         gancho="“O mês foi bom. Então por que não sobrou?”",
         cenas=[
             "O Pix dos cortes caiu na conta pessoal, junto do mercado e da luz de casa.",
             "O dinheiro vivo foi para o bolso e pagou o almoço.",
             "O fiado do Seu Zé ficou no caderno, sem data.",
             "Texto: “Dinheiro misturado some sem ninguém gastar errado.”",
             "Virada: “Primeiro passo: saber exatamente quanto a barbearia fez.”",
         ],
         fecho="“Separar começa por saber.”",
         legenda="Não é gastança. É dinheiro sem endereço.",
         cta="Contar se separa o dinheiro da barbearia do de casa."),
    dict(dia=16, ep=8, pilar="B", seridó=False,
         titulo="Quanto cada barbeiro faz?",
         gancho="“O Júnior jura que corta mais que o tio.”",
         cenas=[
             "Discussão leve: “Fiz mais cortes essa semana!” “Fez nada!”",
             "No caderno é impossível saber: os nomes não dizem quem cortou.",
             "Texto: “Comissão no chute gera briga, até em família.”",
             "No Dashboard, filtro por barbeiro: Tonho 98 atendimentos, Júnior 104 (valores fictícios).",
             "Tonho ri: “É… dessa vez você ganhou.”",
         ],
         fecho="“Número claro, conversa justa.”",
         legenda="Quem trabalha com equipe sabe: a conversa sobre comissão é mais fácil com o número na mão.",
         cta="Contar como é feita a comissão aí."),
    dict(dia=18, ep=9, pilar="C", seridó=False,
         titulo="A comanda",
         gancho="“Corte, R$ 35. Energético, R$ 8. Total?”",
         cenas=[
             "Tonho termina o corte e toca em Concluir.",
             "Abre a comanda: o corte e o energético que o cliente pegou.",
             "Tela: “Total: R$ 43.” Tonho fala em voz alta.",
             "O cliente paga certinho. Texto: “Nada esquecido, nada no chute.”",
             "Texto: “E o estoque do energético já baixou sozinho.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="A comanda mostra o serviço e o que o cliente consumiu. Na hora de fechar, o total está pronto.",
         cta="Confessar se já esqueceu de cobrar algum produto."),
    dict(dia=20, ep=10, pilar="C", seridó=False,
         titulo="O primeiro mês com números",
         gancho="“Pela primeira vez, o Tonho sabe quanto entrou no mês.”",
         cenas=[
             "Fim do mês. Tonho abre o Dashboard no celular.",
             "Na tela: quanto entrou em serviços, quanto na loja e o total (valores fictícios).",
             "Rosca: o serviço mais pedido é Cabelo + Barba; o produto que mais sai é o energético.",
             "Tonho: “Eu achava que o forte era o corte simples…”",
             "Texto: “Número na mão muda a decisão.”",
         ],
         fecho="“Fim do capítulo 2.”",
         legenda="Às vezes o que a gente acha que vende mais não é o que vende mais.",
         cta="Chutar qual serviço mais sai aí (e depois conferir)."),
    dict(dia=22, ep=11, pilar="D", seridó=True,
         titulo="Na rua do Tonho, todo mundo tem um caderno",
         gancho="“Na rua do Tonho, todo mundo tem um caderno.”",
         cenas=[
             "A câmera passeia pela rua: a padaria anotando encomenda, a oficina com a lista de serviços, o mercadinho com o fiado.",
             "Texto: “Negócios diferentes. O mesmo problema.”",
             "Seu Nonato, da padaria: “Fim do mês eu nunca sei quanto vendi.”",
             "Tonho: “Eu sabia que não era só comigo.”",
             "Texto: “No Seridó, a gente se reconhece no problema do vizinho.”",
         ],
         fecho="“E pode se reconhecer na solução também.”",
         legenda="Quem tem comércio no interior sabe do que esse episódio está falando.",
         cta="Contar qual comércio da sua rua tem o caderno mais famoso."),
    dict(dia=24, ep=12, pilar="D", seridó=True,
         titulo="Por que um sistema daqui?",
         gancho="“Esse sistema não veio de longe.”",
         cenas=[
             "Tonho, desconfiado: “Sistema é coisa de cidade grande.”",
             "Texto: “Quem fez o BARBOS conhece a rotina de uma barbearia do interior.”",
             "Exemplos rápidos na tela: o telefone que puxa o nome do cliente, o registro do dia para quem não quer agenda, o link no QR do balcão.",
             "Tonho: “Ah, então foi feito pra gente.”",
         ],
         fecho="“Feito no Seridó. Para barbearia de verdade.”",
         legenda="Ferramenta boa é a que entende a sua rotina.",
         cta="Comentar o que um sistema precisa ter para funcionar aí."),
    dict(dia=26, ep=13, pilar="D", seridó=True,
         titulo="Véspera de festa",
         gancho="“Véspera de festa. A cidade inteira quer cortar o cabelo hoje.”",
         cenas=[
             "Fila na porta, cliente sentado até na calçada, o caderno sem espaço.",
             "Tonho: “Volta às 3.” Cliente: “Às 3 você já tem três!” Confusão.",
             "Corta para o ano seguinte: Tonho abriu os horários da véspera no link uma semana antes.",
             "Agenda cheia, mas organizada: cada cliente chega na sua hora.",
             "Texto: “Festa boa é a que você aproveita também.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Festa da padroeira, São João, fim de ano: no Seridó, toda festa lota a barbearia na véspera.",
         cta="Comentar qual festa lota a barbearia na sua cidade."),
    dict(dia=28, ep=14, pilar="D", seridó=True,
         titulo="A barbearia é o ponto de encontro",
         gancho="“Na cidade pequena, a notícia passa primeiro pela barbearia.”",
         cenas=[
             "Cenas do dia a dia: conversa de futebol, o resultado do jogo, o aposentado que vem só para prosear.",
             "Texto: “A barbearia é ponto de encontro. É parte da cidade.”",
             "Tonho: “Aqui eu corto o cabelo do avô, do pai e do neto.”",
             "Texto: “Um negócio que é parte da cidade merece ser bem cuidado.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Uma homenagem às barbearias que são o coração das cidades do Seridó.",
         cta="Contar a melhor história que já ouviu na cadeira."),
    dict(dia=30, ep=15, pilar="D", seridó=True,
         titulo="Quem é daqui entende",
         gancho="“Isso não é sobre tecnologia.”",
         cenas=[
             "“É sobre o barbeiro que abre cedo e fecha tarde.”",
             "“Sobre o cliente que marca e não precisa esperar na calçada.”",
             "“Sobre fechar o mês sabendo quanto entrou.”",
             "“Sobre negócio do Seridó crescendo do jeito certo.”",
         ],
         fecho="“O BARBOS é daqui. E é para quem é daqui.”",
         legenda="Fecha o capítulo sobre a nossa região. Se você é do Seridó, esse é pra você.",
         cta="Compartilhar nos stories.",
         nota="Episódio manifesto: pode ser gravado com você falando para a câmera, sem o Tonho."),
    dict(dia=32, ep=16, pilar="C", seridó=False,
         titulo="O primeiro sábado organizado",
         gancho="“Sábado, 9h. Dessa vez, sem confusão.”",
         cenas=[
             "Mesmo horário e mesma porta do Ep. 1. Agora o Tonho olha o celular.",
             "Agenda do dia na tela: 9h João, 9h30 Pedro, 10h Carlos (nomes fictícios).",
             "O cliente chega: “Tenho horário às 9.” Tonho: “Tá aqui. Senta.”",
             "Texto: “Quem é o próximo? A resposta está na tela.”",
         ],
         fecho="“Ep. 1 x Ep. 16. Mesma barbearia. Outro sábado.”",
         legenda="Lembra do sábado do primeiro episódio? Olha o sábado de agora.",
         cta="Comentar: hora marcada ou ordem de chegada?"),
    dict(dia=34, ep=17, pilar="C", seridó=False,
         titulo="Folga sem confusão",
         gancho="“O Tonho vai viajar no feriado. E agora?”",
         cenas=[
             "Antes: aviso escrito à mão na porta, “Fechado dia 15”. O cliente que não viu bate na porta fechada.",
             "Agora: no BARBOS, ele marca folga no dia 15.",
             "O link não deixa ninguém marcar nesse dia.",
             "Quem já estava marcado continua na agenda: o sistema mostra quantos são, e o Tonho decide quem avisar.",
             "Texto: “Descansar também faz parte do trabalho.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Folga marcada no sistema fecha o dia para horário novo, sem apagar quem já tinha marcado.",
         cta="Contar quando foi a última folga de verdade."),
    dict(dia=36, ep=18, pilar="C", seridó=False,
         titulo="A loja do balcão",
         gancho="“O cliente comprou um energético sem ninguém sair da cadeira.”",
         cenas=[
             "O cliente que espera a vez vê o QR code da loja no balcão.",
             "Abre no celular: as pomadas e as bebidas, com preço.",
             "Escolhe um energético e lança a compra no atendimento dele.",
             "Texto: “O estoque baixa sozinho. A comanda já sabe.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="A loja do BARBOS abre pelo QR code do balcão e mostra o que tem na prateleira, com preço.",
         cta="Contar qual produto mais sai aí."),
    dict(dia=38, ep=19, pilar="C", seridó=False,
         titulo="O aviso no celular",
         gancho="“Domingo à noite. O cliente marcou. O Tonho nem precisou responder.”",
         cenas=[
             "Tonho no sofá; o celular apita: “Novo agendamento”.",
             "O cliente, logo depois de marcar, foi para o WhatsApp do barbeiro com o recado pronto.",
             "Tonho responde só: “Fechado, até segunda!”",
             "Texto: “O aviso chega no celular, mesmo com o BARBOS fechado.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Quando o cliente marca pelo link, o celular da barbearia avisa na hora.",
         cta="Contar se responde cliente no fim de semana.",
         nota="No iPhone o aviso só chega com o BARBOS adicionado à tela de início. Vale dizer isso na legenda ou num story."),
    dict(dia=40, ep=20, pilar="B", seridó=False,
         titulo="Outubro x novembro",
         gancho="“O Tonho comparou dois meses. E levou um susto.”",
         cenas=[
             "Dashboard, mês a mês: novembro abaixo de outubro.",
             "Ele olha os detalhes: a loja caiu, os serviços se mantiveram.",
             "Lembra: o fornecedor atrasou e a geladeira ficou vazia metade do mês.",
             "Texto: “Sem comparar, ele nunca saberia o motivo.”",
             "Tonho: “Mês que vem a geladeira não fica vazia.”",
         ],
         fecho="“Fim do capítulo 4.”",
         legenda="Comparar um mês com o outro mostra o que mudou, e muitas vezes o porquê.",
         cta="Comentar se compara um mês com o outro."),
    dict(dia=42, ep=21, pilar="B", seridó=False,
         titulo="O Tonho define a meta",
         gancho="“Pela primeira vez, o Tonho tem uma meta.”",
         cenas=[
             "No Dashboard, a média por mês dos últimos meses.",
             "Texto: “Média: R$ 6.200. Meta: R$ 7.000.” (valores fictícios)",
             "O plano: abrir mais horários no sábado pelo link e não deixar a geladeira vazia.",
             "Fim do mês: o total passa da meta.",
             "Tonho: “Agora eu sei onde estou e para onde vou.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Com a média na mão, dá para colocar uma meta que faz sentido.",
         cta="Comentar SIM ou AINDA NÃO: você tem meta de faturamento?"),
    dict(dia=44, ep=22, pilar="D", seridó=True,
         titulo="O vizinho pergunta",
         gancho="“Tonho, como é que tu sabe quanto vendeu?”",
         cenas=[
             "Seu Nonato, da padaria, encostado na porta da barbearia.",
             "Tonho mostra o celular: o mês somado.",
             "Nonato: “Eu faço no caderno e nunca bate.”",
             "Texto: “Quando um negócio daqui se organiza, o vizinho vê. E se anima também.”",
         ],
         fecho="“Seridó crescendo junto.”",
         legenda="Organização pega. Quando um começa, a rua inteira repara.",
         cta="Marcar um amigo empreendedor que precisa ver isso.",
         nota="O BARBOS é para barbearia. O episódio fala de inspiração, não ofereça o sistema para a padaria."),
    dict(dia=46, ep=23, pilar="C", seridó=False,
         titulo="Tudo num lugar só",
         gancho="“Um caderno, um WhatsApp, uma gaveta e um app do banco. Ou um lugar só.”",
         cenas=[
             "Montagem rápida, uma tela por segundo: a agenda do dia.",
             "O link de agendamento e o aviso no celular.",
             "A comanda com serviço e consumo.",
             "A loja do balcão e o estoque.",
             "O Dashboard com o mês somado.",
         ],
         fecho="“BARBOS. Agenda, caixa e estoque da sua barbearia.”",
         legenda="Tudo o que a barbearia precisa para trabalhar organizada, no celular.",
         cta="Comentar qual parte usaria primeiro."),
    dict(dia=48, ep=24, pilar="B", seridó=False,
         titulo="Agora o Tonho sabe responder",
         gancho="“Tonho, quanto entrou esse mês?”",
         cenas=[
             "O mesmo jantar do Ep. 6. A mesma pergunta da Lúcia.",
             "Dessa vez ele pega o celular. Dois segundos.",
             "Na tela: o total do mês, com serviço e loja separados.",
             "Lúcia: “E a média?” Tonho mostra.",
             "Texto: “De ‘deve ter dado’ para ‘deu isso aqui’.”",
         ],
         fecho="Logo do BARBOS.",
         legenda="Lembra do “deve ter dado” do episódio 6? Agora a resposta é outra.",
         cta="Comentar: se te perguntassem hoje, você saberia responder?"),
    dict(dia=50, ep=25, pilar="D", seridó=True,
         titulo="O caderno pode descansar",
         gancho="“Fim da temporada. O caderno de capa azul vai para a gaveta.”",
         cenas=[
             "Tonho folheia o caderno uma última vez: nomes, rasuras, fiados.",
             "“Esse caderno me ajudou muito.” Fecha com carinho e guarda.",
             "Corta para um sábado cheio e organizado: cliente marcando pelo QR, o mês somado na tela.",
             "Texto: “Não é sobre esquecer de onde veio. É sobre ir mais longe.”",
         ],
         fecho="“BARBOS. Feito no Seridó. Link na bio.”",
         legenda="Obrigado por acompanhar a série Na cadeira do Tonho. Se você quer esse final para a sua barbearia, o link está na bio.",
         cta="Clicar no link da bio. Mandar SERIDÓ no direct."),
]


# ---------------------------------------------------------------------------
# MONTAGEM
# ---------------------------------------------------------------------------
def e(t):
    return html.escape(t, quote=False)


def capitulo_do_dia(dia):
    for numero, nome, ini, fim, _ in CAPITULOS:
        if ini <= dia <= fim:
            return numero, nome
    raise ValueError(dia)


def posts_ordenados():
    todos = [dict(p, formato="Carrossel") for p in CARROSSEIS] + [
        dict(p, formato="Motion") for p in MOTIONS
    ]
    todos.sort(key=lambda p: p["dia"])
    dias = [p["dia"] for p in todos]
    assert dias == list(range(1, 51)), f"dias faltando ou repetidos: {dias}"
    assert len(CARROSSEIS) == 25 and len(MOTIONS) == 25
    return todos


def etiqueta(p):
    pilar = PILARES[p["pilar"]][0]
    partes = [
        f'<span class="dia">Dia {p["dia"]:02d}</span>',
        f'<span class="fmt fmt-{p["formato"].lower()}">{p["formato"]}'
        + (f' · Ep. {p["ep"]}' if p.get("ep") else "")
        + "</span>",
        f'<span class="pil">{e(pilar)}</span>',
    ]
    if p["seridó"]:
        partes.append('<span class="ser">Seridó</span>')
    return '<div class="etiquetas">' + "".join(partes) + "</div>"


def bloco_post(p):
    corpo = [etiqueta(p), f'<h3>{e(p["titulo"])}</h3>']
    if p["formato"] == "Carrossel":
        itens = "".join(
            f"<li><b>{i + 1}.</b> {e(s)}</li>" for i, s in enumerate(p["slides"])
        )
        corpo.append(f'<p class="rot">Slides</p><ol class="lista">{itens}</ol>')
    else:
        corpo.append(f'<p class="rot">Gancho (0 a 3 s)</p><p class="gancho">{e(p["gancho"])}</p>')
        itens = "".join(
            f"<li><b>{i + 1}.</b> {e(s)}</li>" for i, s in enumerate(p["cenas"])
        )
        corpo.append(f'<p class="rot">Cenas</p><ol class="lista">{itens}</ol>')
        corpo.append(f'<p class="rot">Fecho</p><p>{e(p["fecho"])}</p>')
    corpo.append(
        f'<div class="rodape-post"><p><span class="rot-in">Legenda</span> {e(p["legenda"])}</p>'
        f'<p><span class="rot-in">Engajamento</span> {e(p["cta"])}</p>'
        + (f'<p class="nota"><span class="rot-in">Atenção</span> {e(p["nota"])}</p>' if p.get("nota") else "")
        + "</div>"
    )
    return f'<article class="post">{"".join(corpo)}</article>'


def montar():
    posts = posts_ordenados()
    n_seridó = sum(1 for p in posts if p["seridó"])
    por_pilar = {k: sum(1 for p in posts if p["pilar"] == k) for k in PILARES}

    def url(caminho):
        return "file:///" + caminho.replace("\\", "/")

    capa = f"""
<section class="capa">
  <div class="faixa-capa"></div>
  <img class="logo-capa" src="{url(LOGO_ESCURO)}" alt="BARBOS">
  <p class="olho">Planejamento de conteúdo · Instagram @barboss.oficial</p>
  <h1>50 dias de carrosséis e motions com storytelling</h1>
  <p class="sub">25 carrosséis e 25 motions sobre agenda, dinheiro e a realidade das barbearias do Seridó.</p>
  <div class="capa-numeros">
    <div><b>50</b><span>dias</span></div>
    <div><b>25</b><span>carrosséis</span></div>
    <div><b>25</b><span>motions</span></div>
    <div><b>{n_seridó}</b><span>com foco no Seridó</span></div>
  </div>
  <p class="data">Novembro de 2026</p>
</section>"""

    linha_tempo = "".join(
        f'<li><span class="cap-num">{n}</span><div><b>{e(nome)}</b>'
        f'<span class="cap-dias">Dias {ini} a {fim}</span><p>{e(obj)}</p></div></li>'
        for n, nome, ini, fim, obj in CAPITULOS
    )

    visao = f"""
<section>
  <p class="eyebrow">Visão geral</p>
  <h2>O objetivo é conversa, não viral</h2>
  <p class="lead">Esses 50 dias não foram pensados para estourar. Foram pensados para o dono de barbearia
  se ver nos posts, comentar, salvar, mandar para o sócio e chamar no direct. Engajamento de quem
  pode virar cliente vale mais que alcance de quem nunca vai abrir uma barbearia.</p>

  <div class="numeros">
    <div><b>1</b><span>post por dia, durante 50 dias</span></div>
    <div><b>Ímpar</b><span>carrossel (dias 1, 3, 5…)</span></div>
    <div><b>Par</b><span>motion da série do Tonho (dias 2, 4, 6…)</span></div>
    <div><b>{n_seridó}</b><span>posts falando direto com o Seridó e Currais Novos</span></div>
  </div>

  <h3 class="sec">A história em 5 capítulos de 10 dias</h3>
  <p>Os posts contam uma história só, do começo ao fim: primeiro a dor, depois o dinheiro, depois a região,
  depois a virada e por fim o mês que fecha. Quem acompanha desde o começo sente a evolução; quem chega
  no meio entende cada post sozinho.</p>
  <ol class="linha-tempo">{linha_tempo}</ol>
</section>"""

    pilares = "".join(
        f'<div class="pilar"><p class="pilar-nome">{e(nome)} <span>{por_pilar[k]} posts</span></p><p>{e(desc)}</p></div>'
        for k, (nome, desc) in PILARES.items()
    )

    publico = f"""
<section>
  <p class="eyebrow">Para quem e sobre o quê</p>
  <h2>Público, pilares e tom</h2>

  <h3 class="sec">Quem a gente quer alcançar</h3>
  <p>Dono de barbearia com uma a quatro cadeiras, que hoje marca horário no caderno ou no WhatsApp e não sabe
  dizer quanto entrou no mês. Ele não está trocando de software: está saindo do papel. Prioridade para o
  Rio Grande do Norte, e dentro dele o <b>Seridó</b>: Currais Novos, Caicó, Acari, Parelhas, Jardim do Seridó,
  Carnaúba dos Dantas, Cruzeta, Jucurutu e São José do Seridó.</p>

  <h3 class="sec">Os quatro pilares</h3>
  <div class="pilares">{pilares}</div>

  <h3 class="sec">Tom de voz</h3>
  <p>O tom de voz da marca ainda não foi definido. Os textos deste planejamento são <b>rascunho</b>: diretos,
  simples, como conversa de balcão. Leia em voz alta antes de postar e troque o que não soar como você.</p>
  <ul class="regras">
    <li><b>Fale como o barbeiro fala.</b> “Quanto entrou”, “quanto sobrou”, “horário vago”, “cliente que furou”.
    Nada de “ticket médio”, “KPI”, “performance”, “otimizar” ou “solução completa”.</li>
    <li><b>Respeito antes de tudo.</b> Quem usa caderno não é atrasado: é ocupado. Os posts nunca riem do dono
    de barbearia, riem da situação.</li>
    <li><b>Sotaque com moderação.</b> Expressões daqui só quando forem naturais para você. Sotaque forçado soa falso.</li>
    <li><b>Uma ideia por slide.</b> Frase curta, sem lista de tópicos dentro do slide.</li>
  </ul>
</section>"""

    serie = """
<section>
  <p class="eyebrow">Storytelling</p>
  <h2>A série dos motions: “Na cadeira do Tonho”</h2>
  <p class="lead">Os 25 motions são episódios de uma mesma série. Um personagem fixo faz a pessoa voltar para ver
  o próximo, e cada dor do público vira uma cena que ele reconhece.</p>

  <div class="ficha">
    <p class="rot">Ficha do personagem</p>
    <p><b>Tonho</b> (personagem fictício). Barbeiro há 15 anos em Currais Novos, duas cadeiras, trabalha com o
    sobrinho <b>Júnior</b>. Agenda num <b>caderno de capa azul</b>, recados no WhatsApp, dinheiro na gaveta e no Pix.
    Bom de tesoura, perdido nas contas. Casado com a <b>Lúcia</b>, que sempre pergunta quanto entrou no mês.
    Vizinho: <b>Seu Nonato</b>, da padaria, que vive o mesmo problema.</p>
  </div>

  <h3 class="sec">Os ganchos que amarram a série</h3>
  <ul class="regras">
    <li><b>O caderno de capa azul</b> aparece em quase todo episódio e vai para a gaveta no último (Ep. 25).</li>
    <li><b>“Tonho, quanto entrou esse mês?”</b> Ele não sabe responder no Ep. 6 e responde em dois segundos no Ep. 24.</li>
    <li><b>O sábado das 9h:</b> confusão no Ep. 1, organizado no Ep. 16, com a mesma porta e o mesmo horário.</li>
    <li><b>A rua do Tonho</b> (Ep. 11 e 22): os vizinhos comerciantes mostram que a realidade é de todo o Seridó.</li>
  </ul>

  <h3 class="sec">Como gravar (escolha um jeito e mantenha até o fim)</h3>
  <ul class="regras">
    <li><b>Encenado:</b> um barbeiro conhecido faz o Tonho, com autorização por escrito. Deixe claro que é encenação.</li>
    <li><b>Só motion:</b> texto animado, sons de barbearia, o caderno filmado de perto e telas do sistema. O Tonho existe só na narração.</li>
    <li><b>Narração em off</b> sobre imagens de uma barbearia real (sem mostrar rosto de cliente sem autorização).</li>
  </ul>
  <p class="aviso"><b>Importante:</b> diga na legenda do Ep. 1 (e num destaque fixo) que o Tonho é personagem, inspirado na rotina das
  barbearias daqui. Ele nunca pode aparecer como depoimento de cliente.</p>
</section>"""

    formatos = """
<section>
  <p class="eyebrow">Produção</p>
  <h2>Formatos, legenda e stories</h2>

  <div class="duas">
    <div class="caixa">
      <p class="rot">Carrossel</p>
      <ul>
        <li>1080 × 1350 px (4:5), de 6 a 8 slides.</li>
        <li>Capa com o gancho em até 8 palavras.</li>
        <li>Uma ideia por slide; o penúltimo traz a virada.</li>
        <li>Último slide: a pergunta de engajamento + @barboss.oficial.</li>
        <li>Fundo grafite e claro alternados; âmbar só no destaque e no fecho.</li>
      </ul>
    </div>
    <div class="caixa">
      <p class="rot">Motion</p>
      <ul>
        <li>1080 × 1920 px (9:16), de 20 a 40 segundos.</li>
        <li>Gancho escrito na tela nos 3 primeiros segundos.</li>
        <li>Legenda embutida: a maioria assiste sem som.</li>
        <li>Telas do sistema gravadas na conta de teste BARBO.</li>
        <li>Fecho com o logo e “Na cadeira do Tonho · Ep. N”.</li>
      </ul>
    </div>
  </div>

  <h3 class="sec">Legenda padrão</h3>
  <ol class="regras">
    <li>Primeira linha: o gancho (a mesma ideia da capa, com outras palavras).</li>
    <li>Duas ou três frases de contexto.</li>
    <li>A pergunta de engajamento do post.</li>
    <li>Uma linha sobre o BARBOS só quando o post for do pilar “BARBOS na prática” ou do capítulo 5. Nos outros, a conversa vem primeiro.</li>
    <li>De 5 a 8 hashtags, misturando as gerais e as da região.</li>
  </ol>
  <p class="hashtags"><b>Gerais:</b> #barbearia #barbeiro #donodebarbearia #gestaodebarbearia #agendaonline #empreendedorismo
  <br><b>Região:</b> #serido #seridopotiguar #curraisnovos #caico #riograndedonorte #rn #acari #parelhas</p>

  <h3 class="sec">Horário de postar</h3>
  <p>Teste dois horários na primeira semana: no almoço (12h às 13h) e à noite, depois que a barbearia fecha
  (20h às 21h). Fique com o que trouxer mais salvamentos e comentários. Barbeiro não olha o celular no pico do sábado.</p>

  <h3 class="sec">Stories de apoio (todo dia)</h3>
  <ul class="regras">
    <li><b>Repost do post do dia</b> com o adesivo de “novo post”.</li>
    <li><b>Uma enquete ligada ao tema.</b> Exemplos: “Sua agenda é no caderno ou no celular?”, “Você sabe quanto faturou mês passado?”,
    “Hora marcada ou ordem de chegada?”, “De qual cidade do Seridó você é?”.</li>
    <li><b>Caixa de perguntas uma vez por semana</b>, respondida nos dias seguintes.</li>
    <li><b>Comentários bons viram story</b> (com o @ da pessoa, se ela topar).</li>
  </ul>
</section>"""

    regras = """
<section>
  <p class="eyebrow">Antes de postar</p>
  <h2>Regras de ouro</h2>
  <ul class="regras grandes">
    <li><b>Nenhum número inventado sobre o mercado.</b> Nada de “70% das barbearias…”. Conta de exemplo leva a palavra “exemplo” escrita no slide.</li>
    <li><b>O Tonho é personagem</b> e é apresentado assim. Nunca vira depoimento.</li>
    <li><b>Print do sistema só da conta de teste BARBO.</b> Nunca da conta de uma barbearia real: a tela pode mostrar nome e telefone de cliente. Valores na tela são fictícios.</li>
    <li><b>BARBOS sempre em caixa alta.</b> Nunca “Barbos” ou “barbos”.</li>
    <li><b>Visual da marca:</b> grafite e âmbar. Texto escuro sobre âmbar, nunca branco. Sem poste de barbeiro, tesoura, navalha ou bigode como ícone.</li>
    <li><b>Prometer só o que o sistema faz hoje</b> (lista abaixo). O BARBOS mostra o que ENTROU; ele não controla contas a pagar, então nunca diga que ele calcula o lucro.</li>
    <li><b>Responder todo comentário nas primeiras horas.</b> Engajamento é conversa: comentário sem resposta morre.</li>
  </ul>

  <h3 class="sec">O que o BARBOS faz e os posts podem citar</h3>
  <ul class="recursos">
    <li>Agenda do dia, por barbeiro, que avisa quando o horário já está ocupado.</li>
    <li>Link de agendamento fixo (bio, WhatsApp e QR code impresso a partir dele).</li>
    <li>Cliente marca sozinho; o telefone puxa o nome de quem já marcou antes.</li>
    <li>Aviso no celular quando o cliente marca (no iPhone, com o BARBOS na tela de início).</li>
    <li>O cliente vai para o WhatsApp do barbeiro com o recado pronto.</li>
    <li>Folga: fecha o dia para horário novo sem apagar quem já marcou.</li>
    <li>Comanda: serviço mais o consumo do cliente, com o total.</li>
    <li>Loja do balcão por QR code, com estoque que baixa sozinho.</li>
    <li>Registro manual do dia, para quem não quer usar agenda.</li>
    <li>Dashboard: quanto entrou no mês, serviços x loja, serviço mais pedido, produto mais vendido, mês a mês, média por mês e filtro por barbeiro.</li>
    <li>Funciona no celular, pelo navegador, e pode ir para a tela de início.</li>
  </ul>
</section>"""

    linhas = "".join(
        f'<tr><td class="num">{p["dia"]:02d}</td>'
        f'<td class="nw">{p["formato"]}{(" · Ep. " + str(p["ep"])) if p.get("ep") else ""}</td>'
        f'<td class="num">{capitulo_do_dia(p["dia"])[0]}</td>'
        f'<td class="nw">{e(PILARES[p["pilar"]][0])}</td>'
        f'<td>{e(p["titulo"])}</td>'
        f'<td class="ctr">{"●" if p["seridó"] else ""}</td></tr>'
        for p in posts
    )
    calendario = f"""
<section>
  <p class="eyebrow">Calendário</p>
  <h2>Os 50 dias numa tabela</h2>
  <table class="cal">
    <thead><tr><th>Dia</th><th>Formato</th><th>Cap.</th><th>Pilar</th><th>Título</th><th>Seridó</th></tr></thead>
    <tbody>{linhas}</tbody>
  </table>
</section>"""

    capitulos_html = []
    for numero, nome, ini, fim, objetivo in CAPITULOS:
        dele = [p for p in posts if ini <= p["dia"] <= fim]
        capitulos_html.append(f"""
<section class="capitulo">
  <div class="cab-cap">
    <p class="eyebrow">Capítulo {numero} · Dias {ini} a {fim}</p>
    <h2>{e(nome)}</h2>
    <p class="lead">{e(objetivo)}</p>
  </div>
  {"".join(bloco_post(p) for p in dele)}
</section>""")

    medir = """
<section>
  <p class="eyebrow">Acompanhamento</p>
  <h2>Como saber se está funcionando</h2>
  <p class="lead">Como o objetivo é engajamento, curtida e visualização contam pouco. Olhe primeiro o que mostra
  que a pessoa parou, pensou e quis continuar a conversa.</p>

  <div class="duas">
    <div class="caixa">
      <p class="rot">O que mais importa</p>
      <ul>
        <li>Salvamentos</li>
        <li>Compartilhamentos</li>
        <li>Comentários (e quantos você respondeu)</li>
        <li>Respostas às enquetes e caixas dos stories</li>
        <li>Mensagens no direct (palavras SERIDÓ e QR)</li>
      </ul>
    </div>
    <div class="caixa">
      <p class="rot">Para acompanhar de lado</p>
      <ul>
        <li>Visitas ao perfil e cliques no link da bio</li>
        <li>Seguidores novos</li>
        <li>Principais cidades do público (Insights &gt; Público): Currais Novos e Caicó devem subir</li>
        <li>Quantos episódios da série a pessoa assiste até o fim</li>
      </ul>
    </div>
  </div>

  <h3 class="sec">Revisão de toda semana (dias 7, 14, 21, 28, 35, 42 e 49)</h3>
  <ol class="regras">
    <li>Anote os dois posts com mais salvamentos e comentários da semana.</li>
    <li>Veja o que eles têm em comum: pilar, formato, tipo de pergunta, foco no Seridó.</li>
    <li>Ajuste a semana seguinte: mais do que funcionou, troque o que ninguém comentou.</li>
    <li>Leve as melhores perguntas dos comentários para os stories e para os próximos posts.</li>
  </ol>

  <table class="acomp">
    <thead><tr><th>Semana</th><th>Dias</th><th>Melhor post</th><th>Salv.</th><th>Coment.</th><th>Directs</th><th>O que repetir</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>1 a 7</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>2</td><td>8 a 14</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>3</td><td>15 a 21</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>4</td><td>22 a 28</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>5</td><td>29 a 35</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>6</td><td>36 a 42</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>7</td><td>43 a 50</td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
</section>"""

    corpo = capa + visao + publico + serie + formatos + regras + calendario + "".join(capitulos_html) + medir
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>BARBOS · Planejamento Instagram 50 dias</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>{CSS}</style></head>
<body>{corpo}</body></html>"""


CSS = """
:root {
  --graf-950:#0D0F12; --graf-900:#14171C; --graf-800:#1C2027; --graf-700:#2A2F38;
  --graf-500:#5B6472; --graf-300:#A8B0BC; --graf-200:#C9CFD8; --graf-100:#E4E7EC; --graf-50:#F4F6F8;
  --ambar-800:#8A5309; --ambar-500:#F0A93B; --ambar-100:#FCEDD3;
}
@page { size: A4; margin: 15mm 14mm 16mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; }
body { font-family: Inter, "Segoe UI", Arial, sans-serif; color: var(--graf-900); font-size: 10pt; line-height: 1.5; background: #fff; }
b { font-weight: 700; }

/* capa */
.capa { width: 210mm; height: 297mm; background: var(--graf-900); color: #fff; padding: 30mm 22mm 24mm;
  position: relative; display: flex; flex-direction: column; break-after: page; overflow: hidden; }
.faixa-capa { position: absolute; top: 0; left: 0; right: 0; height: 6mm; background: var(--ambar-500); }
.logo-capa { width: 62mm; margin-bottom: 34mm; }
.capa .olho { color: var(--ambar-500); font-size: 9.5pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; margin: 0 0 6mm; }
.capa h1 { font-size: 34pt; line-height: 1.05; letter-spacing: -.03em; font-weight: 800; margin: 0 0 7mm; max-width: 150mm; }
.capa .sub { font-size: 13pt; color: var(--graf-300); max-width: 140mm; margin: 0; }
.capa-numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin-top: auto; }
.capa-numeros div { border-top: 1.2mm solid var(--ambar-500); padding-top: 3mm; }
.capa-numeros b { display: block; font-size: 26pt; font-weight: 800; letter-spacing: -.02em; }
.capa-numeros span { color: var(--graf-300); font-size: 9pt; }
.capa .data { color: var(--graf-300); font-size: 9pt; margin: 10mm 0 0; }

/* seções */
section { break-before: page; }
.capa + section { break-before: auto; }
.eyebrow { color: var(--ambar-800); font-size: 8.5pt; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; margin: 0 0 2mm; }
h2 { font-size: 22pt; line-height: 1.1; letter-spacing: -.025em; font-weight: 800; margin: 0 0 4mm; break-after: avoid; }
h3.sec { font-size: 12.5pt; font-weight: 700; margin: 7mm 0 2.5mm; break-after: avoid; }
.lead { font-size: 11.5pt; color: var(--graf-700); margin: 0 0 5mm; }
p { margin: 0 0 2.5mm; }

.numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 4mm 0 2mm; }
.numeros div { background: var(--graf-50); border: 1px solid var(--graf-100); border-radius: 2mm; padding: 3.5mm; }
.numeros b { display: block; font-size: 17pt; font-weight: 800; color: var(--graf-900); }
.numeros span { font-size: 8.5pt; color: var(--graf-500); }

.linha-tempo { list-style: none; padding: 0; margin: 3mm 0 0; }
.linha-tempo li { display: flex; gap: 4mm; padding: 3mm 0; border-bottom: 1px solid var(--graf-100); break-inside: avoid; }
.cap-num { flex: none; width: 9mm; height: 9mm; border-radius: 2mm; background: var(--ambar-500); color: var(--graf-900);
  font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 12pt; }
.linha-tempo b { font-size: 11pt; }
.cap-dias { margin-left: 2.5mm; color: var(--graf-500); font-size: 8.5pt; font-weight: 600; }
.linha-tempo p { margin: .8mm 0 0; color: var(--graf-700); }

.pilares { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.pilar { border: 1px solid var(--graf-100); border-left: 1.2mm solid var(--ambar-500); border-radius: 2mm; padding: 3mm 3.5mm; break-inside: avoid; }
.pilar-nome { font-weight: 800; font-size: 11pt; margin-bottom: 1mm; }
.pilar-nome span { font-weight: 600; font-size: 8.5pt; color: var(--graf-500); margin-left: 2mm; }
.pilar p:last-child { margin: 0; color: var(--graf-700); font-size: 9.2pt; }

.regras { padding-left: 5mm; margin: 0; }
.regras li { margin-bottom: 2mm; break-inside: avoid; }
.regras.grandes li { margin-bottom: 3mm; font-size: 10.5pt; }
.recursos { columns: 2; column-gap: 7mm; padding-left: 5mm; margin: 0; font-size: 9.3pt; }
.recursos li { break-inside: avoid; margin-bottom: 1.5mm; }

.ficha { background: var(--ambar-100); border-radius: 2mm; padding: 4mm 4.5mm; margin: 2mm 0 1mm; }
.aviso { background: var(--graf-50); border-left: 1.2mm solid var(--graf-900); padding: 3mm 4mm; margin-top: 4mm; }

.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 2mm 0; }
.caixa { border: 1px solid var(--graf-100); border-radius: 2mm; padding: 3.5mm 4mm; break-inside: avoid; }
.caixa ul { padding-left: 4.5mm; margin: 0; }
.caixa li { margin-bottom: 1.2mm; }
.rot { font-size: 8pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--graf-500); margin: 2.5mm 0 1mm; break-after: avoid; }
.caixa .rot, .ficha .rot { margin-top: 0; }
.hashtags { background: var(--graf-50); border-radius: 2mm; padding: 3mm 4mm; font-size: 9.3pt; }

/* calendário */
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
.cal th, .acomp th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; color: var(--graf-500);
  border-bottom: 1.5px solid var(--graf-900); padding: 1.8mm 2mm; }
.cal td { border-bottom: 1px solid var(--graf-100); padding: 1.05mm 2mm; font-size: 8.3pt; line-height: 1.35; vertical-align: top; }
.nw { white-space: nowrap; }
.cal tr:nth-child(even) td { background: var(--graf-50); }
.num { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
.ctr { text-align: center; color: var(--ambar-800); }
.acomp { margin-top: 4mm; }
.acomp td { border: 1px solid var(--graf-200); height: 9mm; padding: 1.5mm 2mm; font-size: 9pt; }

/* capítulos e posts */
.cab-cap { background: var(--graf-900); color: #fff; border-radius: 2.5mm; padding: 5mm 6mm 4mm; margin-bottom: 4mm; border-top: 2mm solid var(--ambar-500); }
.cab-cap .eyebrow { color: var(--ambar-500); }
.cab-cap h2 { color: #fff; }
.cab-cap .lead { color: var(--graf-300); margin: 0; }
.post { border: 1px solid var(--graf-200); border-radius: 2.5mm; padding: 3.2mm 4mm 2.4mm; margin-bottom: 3.2mm; break-inside: avoid; }
.post h3 { font-size: 12pt; line-height: 1.2; letter-spacing: -.01em; font-weight: 800; margin: 1.2mm 0 1mm; }
.post .rot { margin: 1.6mm 0 .6mm; }
.post p { margin-bottom: 1.5mm; }
.etiquetas { display: flex; flex-wrap: wrap; gap: 1.5mm; align-items: center; }
.etiquetas span { font-size: 7.6pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; border-radius: 1.2mm; padding: .7mm 2mm; }
.dia { background: var(--graf-900); color: #fff; font-variant-numeric: tabular-nums; }
.fmt { border: 1px solid var(--graf-900); color: var(--graf-900); }
.fmt-motion { background: var(--ambar-500); border-color: var(--ambar-500); }
.pil { background: var(--graf-100); color: var(--graf-700); }
.ser { background: var(--ambar-100); color: var(--ambar-800); }
.lista { list-style: none; padding: 0; margin: 0; }
.lista li { padding: .5mm 0; border-bottom: 1px dashed var(--graf-100); font-size: 9pt; line-height: 1.4; }
.lista li:last-child { border-bottom: 0; }
.lista b { color: var(--ambar-800); margin-right: 1mm; font-variant-numeric: tabular-nums; }
.gancho { font-weight: 700; font-size: 10.5pt; }
.rodape-post { border-top: 1px solid var(--graf-100); margin-top: 1.5mm; padding-top: 1.5mm; font-size: 8.8pt; line-height: 1.4; }
.rodape-post p { margin-bottom: .8mm; }
.rot-in { font-size: 7.6pt; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--graf-500); margin-right: 1.5mm; }
.nota { background: var(--ambar-100); border-radius: 1.2mm; padding: 1.5mm 2.5mm; }
.nota .rot-in { color: var(--ambar-800); }
"""


def achar_chrome():
    for c in CHROMES:
        if os.path.exists(c):
            return c
    for nome in ("chrome", "msedge", "chromium"):
        achado = shutil.which(nome)
        if achado:
            return achado
    sys.exit("Chrome ou Edge não encontrado.")


def main():
    documento = montar()
    pasta = tempfile.mkdtemp(prefix="barbos-plano-")
    entrada = os.path.join(pasta, "planejamento.html")
    with open(entrada, "w", encoding="utf-8") as f:
        f.write(documento)

    cmd = [
        achar_chrome(),
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        "--allow-file-access-from-files",
        f"--print-to-pdf={SAIDA}",
        "file:///" + entrada.replace("\\", "/"),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not os.path.exists(SAIDA):
        sys.exit(f"Falhou: {r.stderr[-800:]}")
    shutil.copy(entrada, os.path.join(pasta, "copia.html"))
    print(f"PDF: {SAIDA}")
    print(f"HTML de conferência: {entrada}")


if __name__ == "__main__":
    main()
