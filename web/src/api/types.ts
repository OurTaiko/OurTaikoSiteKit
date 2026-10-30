// What both sites' APIs return. A site's own api/types.ts re-exports these and
// adds its Chart, User and Category, which build on ChartBase, UserBase and
// CategoryBase; the generic types take the site's own as their parameter.

export type Locale = 'en' | 'ja' | 'zh' | 'ko'
export type UserBase = {
  id: string
  username: string
  nickname: string
  emailVerified: boolean
  isAdmin: boolean
  preferredLanguage?: string
  avatarUrl?: string
}
export type Session<U extends UserBase = UserBase> = { user: U | null; csrfToken: string }
export type CategoryBase = { id: string; title: string; genre: string }

export type Side = 'single' | 'p1' | 'p2'
/**
 * One chart block: a course (Easy to Edit) on one side, as the arcade keeps a
 * single, a 1P and a 2P chart per course. The side is the block's #START:
 * plain is single, #START P1 p1, #START P2 p2.
 */
export type Difficulty = {
  /** The block's ID on the server; absent for a file that is not uploaded yet. */
  id?: number
  /** Easy, Normal, Hard, Oni or Edit. */
  course: string
  side: Side
  level: number
  maker: string
  branching?: boolean
  /**
   * The server's content hash of the block as played ("v1:" + 64 hex): the block's identity for
   * scores and 段位 courses. Null until the server has computed it; absent in the browser's own parse.
   */
  chartHash?: string | null
  /** The block's difficulty constants by route, in a chart's detail only (none until rated). */
  constants?: DifficultyConstants[]
}
/** One route's difficulty constants (定数): the main and 75/99 sub-constants and five dimensions, 0–15.5. */
export type DifficultyConstants = {
  route: 'unbranched' | 'normal' | 'expert' | 'master'
  mainConstant: number
  subConstant75: number
  subConstant99: number
  stamina: number
  handspeed: number
  burst: number
  complex: number
  rhythm: number
}
/** Title dictionaries as the TJA has them: `origin` is TITLE/SUBTITLE itself, the rest locales. */
export type TitleTexts = Partial<Record<Locale | 'origin' | 'zh_tw', string>>

export type ChartBase = {
  /** 32 lowercase hex digits. */
  id: string
  /** The chart's short number; GET /charts/{number} finds it too. */
  numberId: number
  title: string
  subtitle: string
  titleTranslations: TitleTexts
  subtitleTranslations: TitleTexts
  maker: string
  bpm: number
  offset: number
  demoStart: number
  demoEnd: number
  wave: string
  difficulties: Difficulty[]
  categoryIds: string[]
  ownerIds?: string[]
  owners?: { id: string; nickname: string; avatarUrl?: string }[]
  /** Original uploader; use ownerIds for ownership. */
  ownerId: string
  uploader: string
  uploaderAvatarUrl?: string
  description: string
  createdAt: string
  /** When the chart or anything about it last changed (votes, comments, files, blocks). */
  updateAt: string
  duration: number
  tjaName: string
  audioName: string
  audioHash: string
  audioSize: number
  coverHash?: string
  /** Transcoded background movie; absent when the chart has none. */
  movieHash?: string
  movieSize?: number
  score: number
  upvotes: number
  downvotes: number
  commentCount: number
  /** Only filled on the signed-in detail view. */
  myVote: Vote
}
export type ChartList<C extends ChartBase = ChartBase> = {
  items: C[]
  total: number
  page: number
  pageSize: number
}

export type Vote = -1 | 0 | 1
export type VoteResult = { score: number; upvotes?: number; downvotes?: number; myVote: Vote }
export type CommentSort = 'best' | 'top' | 'new' | 'old' | 'controversial'
export type Comment = {
  id: string
  /** The chart the comment is on, or (for a 段位 course) the course. */
  chartId?: string
  chartTitle?: string
  danId?: string
  danTitle?: Record<string, string>
  parentId: string | null
  depth: number
  authorId: string
  author: string
  authorAvatarUrl?: string
  body: string
  createdAt: string
  editedAt: string | null
  deleted: boolean
  removed: boolean
  score: number
  myVote: Vote
  replyCount: number
  replies: Comment[]
}
export type CommentPage = {
  items: Comment[]
  total: number
  commentCount: number
  page: number
  pageSize: number
  sort: CommentSort
}
export type CommentThread = { item: Comment; sort: CommentSort }
export type CommentList = { items: Comment[]; total: number; page: number; pageSize: number }

export type NotificationKind =
  | 'comment_reply'
  | 'chart_comment'
  | 'chart_upvotes'
  | 'dan_comment'
  | 'dan_upvotes'
  | 'comment_upvotes'
  | 'comment_removed'
export type AppNotification = {
  id: string
  // Unknown future kinds still render with a generic message.
  kind: NotificationKind | (string & {})
  createdAt: string
  read: boolean
  actor: { id: string; nickname: string; avatarUrl?: string } | null
  chart: { id: string; title: string } | null
  dan: { id: string; title: Record<string, string> } | null
  comment: { id: string; parentId: string | null; excerpt: string } | null
  data: {
    upvotes?: number
    /** upload_result: outcome of an upload the user did not wait for. */
    status?: 'published' | 'updated' | 'failed' | (string & {})
    title?: string
    code?: string
    failedFiles?: { file: string; code: string }[]
    /** playlist_removed: the deleted playlist's name. */
    name?: string
  } & Record<string, unknown>
}
export type NotificationPage = {
  items: AppNotification[]
  total: number
  unread: number
  page: number
  pageSize: number
}
export type NotificationSetting = { kind: NotificationKind | (string & {}); enabled: boolean }

export type LeaderboardEntry = {
  id: string
  userId: string
  nickname: string
  avatarUrl?: string
  rank: number
  score: number
  good: number
  ok: number
  bad: number
  drumroll: number
  submittedAt: string
}
export type Leaderboard = {
  songId: string
  /** The ranked chart block; `course` and `side` describe it. */
  difficultyId: number
  course: string
  side: string
  items: LeaderboardEntry[]
  total: number
  page: number
  pageSize: number
}

export type PublicUser = {
  id: string
  nickname: string | null
  avatarUrl?: string
  firstLoginAt: string | null
  lastActiveAt: string | null
  /** Published charts the user uploaded. */
  chartCount: number
  scoreCount: number
  commentCount: number
  karma: number
  /** Public playlists only. */
  playlistCount: number
}
export type UserDirectory = {
  items: PublicUser[]
  total: number
  page: number
  pageSize: number
  profilesAvailable: boolean
}
export type UserSpace = { user: PublicUser; profilesAvailable: boolean }

/** System playlists are computed by the server: no owner, read-only. */
export type Playlist<C extends ChartBase = ChartBase> = {
  id: string
  name: string
  description: string
  public: boolean
  system: boolean
  categoryId: string
  genre: string
  ownerId?: string
  owner: { id: string; nickname: string; avatarUrl?: string } | null
  coverHash?: string
  chartCount: number
  favoriteCount: number
  favorited: boolean
  createdAt: string | null
  updatedAt: string | null
  /** Only in the viewer's own list when it asks about one chart. */
  containsChart?: boolean
  /** Only in the detail response, in playlist order. */
  charts?: C[]
}
export type PlaylistPage<C extends ChartBase = ChartBase> = {
  items: Playlist<C>[]
  total: number
  page: number
  pageSize: number
}
export type MyPlaylists<C extends ChartBase = ChartBase> = {
  owned: Playlist<C>[]
  favorites: Playlist<C>[]
  maxPlaylists: number
  maxItems: number
}

// 段位 courses (OurTaikoPlay's course format, as GET /api/v1/dans returns them).
export type DanExamType = 'gauge' | 'good' | 'ok' | 'bad' | 'hits' | 'score' | 'combo' | 'rolls'
export type DanExam = {
  type: DanExamType
  range: 'more' | 'less'
  // [red] or [red, gold] for the course, or one such (or null) per song.
  value: number[] | (number[] | null)[]
}
export type DanRewardTitle = {
  id: string
  on: 'red' | 'red1' | 'red2' | 'red3' | 'gold' | 'gold4' | 'gold5' | 'gold6'
}
export type DanSong = {
  /** The block the course plays: a chart, a course and a side. */
  chart: {
    id: string
    course: 'Easy' | 'Normal' | 'Hard' | 'Oni' | 'Edit'
    side: Side
  }
  title: string
  subtitle: string
  hidden: boolean
  level: number
  /** False once the block's content changed or went, until the maker picks a block again. */
  valid: boolean
  /** Valid and the chart still published: the game may challenge it. */
  available: boolean
}
export type Dan = {
  id: string
  title: Record<string, string>
  color: number
  /** Six capital letters or digits, unique on the server: the game's 外伝 entry takes it. */
  code: string
  official: boolean
  songs: DanSong[]
  exams: DanExam[]
  rewards: { dan?: number; titles?: DanRewardTitle[] }
  ownerId: string
  owner: string
  createdAt: string
  updatedAt: string
  score: number
  upvotes: number
  downvotes: number
  commentCount: number
  /** Only filled on the detail page. */
  myVote: Vote
}
export type DanInput = {
  title: Record<string, string>
  color: number
  /** Chosen on creation; left out for a random one. */
  code?: string
  songs: { chartId: string; course: string; side: string; hidden: boolean }[]
  exams: DanExam[]
  rewards: { dan?: number; titles?: DanRewardTitle[] }
}
