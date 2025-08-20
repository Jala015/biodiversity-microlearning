# 🎯 Projeto: MicroLearning de Fauna

## 1. Objetivo

Uma plataforma de microlearning open source, minimalista e self-hosted, focada no estudo de grupos de fauna. O aprendizado é baseado em flashcards e quizzes com um sistema de repetição espaçada.

O usuário pode criar "decks" de estudo a partir de duas fontes:
1.  **Espécies Locais**: Geradas dinamicamente utilizando a API do [iNaturalist](https://www.inaturalist.org), com base na localização do usuário.
2.  **Pacotes Curados**: Decks personalizados com conteúdo mais rico, incluindo múltiplas imagens, áudios e descrições detalhadas em Markdown (funcionalidade futura).

A interface é construída com Nuxt 3, visando ser leve, intuitiva e agradável.

---

## 2. Stack Tecnológica

*   **Frontend**: Nuxt 3 (Vue 3 + Composition API)
*   **Estilo**: Tailwind CSS (via `app.css`)
*   **Armazenamento Local**: Pinia stores (`stores/progress.ts`) para persistir o progresso do usuário no LocalStorage do navegador.
*   **Fonte de Dados**:
    *   API do iNaturalist para espécies locais.
    *   Arquivos JSON/Markdown para pacotes curados (planejado).
*   **Gerenciador de Pacotes**: Bun

---

## 3. Funcionalidades Atuais e Planejadas

*   **Criação de Decks via iNaturalist**: Uma página dedicada (`/decks/novo-inat`) permite ao usuário gerar um deck de espécies com base em uma localização no mapa.
*   **Listagem de Decks**: A página `/decks` exibe os decks que o usuário já criou ou importou.
*   **Repetição Espaçada**: O algoritmo de repetição espaçada já está implementado no store `stores/progress.ts` utilizando a biblioteca `ts-fsrs` para otimizar a retenção do conhecimento.
*   **Rastreamento de Progresso**: O mesmo store `progress.ts` gerencia o estado e o progresso do usuário para cada card.
*   **Visualização de Flashcards**: Sistema para estudar os cards de um deck (a ser implementado).
*   **Exportação e Importação**: Funcionalidade para backup e transferência do progresso do usuário (planejado).

---

## 4. Estrutura de Arquivos do Projeto

A estrutura atual do projeto é focada na simplicidade, contendo os seguintes diretórios e arquivos principais:

```
app/
├── assets/
│   ├── app.css         # Estilos globais (Tailwind)
│   └── crosshair.svg   # Ícone para o mapa
│
├── components/
│   ├── deck/
│   │   └── List.vue    # Componente para listar os decks salvos
│   ├── gerador/
│   │   └── Mapa.vue    # Componente de mapa para selecionar a área de busca no iNaturalist
│   └── menus/
│       ├── Dock.vue    # Menu de navegação inferior (dock)
│       └── Navbar.vue  # Barra de navegação superior
│
├── pages/
│   ├── index.vue       # Página inicial da aplicação
│   └── decks/
│       ├── index.vue   # Página que exibe a lista de decks
│       └── novo-inat.vue # Página para criar um novo deck a partir do iNaturalist
│
└── stores/
    └── progress.ts     # Store do Pinia para gerenciar o estado e o progresso
```

---

## 5. Como Executar o Projeto

1.  **Instale as dependências** (se for o primeiro uso):
    ```bash
    bun install
    ```

2.  **Inicie o servidor de desenvolvimento**:
    ```bash
    bun run dev
    ```

3.  Abra o navegador em [http://localhost:3000](http://localhost:3000).
