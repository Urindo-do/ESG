export const ACTIONS = [
  { id: 'eat', label: '밥 먹기', icon: '🍚', thought: '냠냠, 한 입 더!', target: [1.75, 0.03], face: [1.75, -0.63], duration: 7 },
  { id: 'drink', label: '물 마시기', icon: '💧', thought: '찰방찰방, 시원해.', target: [2.63, 0.03], face: [2.63, -0.63], duration: 6 },
  { id: 'play', label: '공놀이', icon: '⚽', thought: '내 공 받아라, 멍!', target: [-1.65, 2.95], face: [-1.65, 2.42], duration: 9 },
  { id: 'read', label: '책 구경하기', icon: '📖', thought: '이건 무슨 이야기지?', target: [1.5, -1.86], face: [2.48, -2.66], duration: 8 },
  { id: 'sleep', label: '낮잠 자기', icon: '☁️', thought: '햇살 이불 덮고… 쿨쿨.', target: [-2.3, 0.33], face: [-2.3, 2], duration: 16 },
  { id: 'run', label: '산책하기', icon: '🌿', thought: '마당 한 바퀴! 신난다!', target: [-2.6, 2.8], face: [0, 2.8], duration: 12 },
  { id: 'tidy', label: '장난감 정리', icon: '🧺', thought: '놀았으니 제자리에.', target: [2.37, -1.36], face: [3.02, -1.55], duration: 7 },
  { id: 'look', label: '창밖 구경', icon: '🪴', thought: '바람이 좋은 냄새를 데려왔어.', target: [0.86, -2.45], face: [0.86, -3.1], duration: 9 },
  { id: 'shake', label: '몸 털기', icon: '✨', thought: '부르르! 다시 뽀송뽀송.', target: [0, 0.3], face: [1, 3], duration: 3 },
  { id: 'sniff', label: '냄새 맡기', icon: '🐾', thought: '킁킁… 여기에 누가 왔을까?', target: [-2.6, 1.95], face: [-3.3, 1.3], duration: 6 },
];

export const actionById = Object.fromEntries(ACTIONS.map(action => [action.id, action]));
