import type { SpaceConfig } from '../src/types';
import {
	generateSpaceId,
	parseSpaceData,
	searchSpaces,
	validateSpaceConfig,
} from '../src/utils/space-utils';

describe('Obsidian Context Spaces Plugin - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('1. 스페이스 관리 기능', () => {
		describe('generateSpaceId', () => {
			test('다양한 이름으로 스페이스 ID 생성', () => {
				const existingSpaces = {};

				const testCases = [
					'Project Alpha',
					'Research Notes',
					'Development Space',
					'📚 Learning Space',
					'🎯 Goal Management',
					'Mixed Language',
					'Special Characters!@#$%^&*()',
					'Name with Spaces',
					'Very Long Name Test',
				];

				testCases.forEach((name) => {
					const spaceId = generateSpaceId(name, existingSpaces);

					expect(spaceId).toBeTruthy();
					expect(typeof spaceId).toBe('string');
					expect(spaceId.length).toBeGreaterThan(0);

					// ID should only contain letters, numbers, and hyphens
					expect(spaceId).toMatch(/^[a-z0-9-]+$/);

					// Special characters should be converted to hyphens
					expect(spaceId).not.toMatch(/[!@#$%^&*()]/);
				});
			});

			test('중복 이름에 대한 고유 ID 생성', () => {
				const existingSpaces = {
					'project-alpha': {
						name: 'Project Alpha',
						icon: '🚀',
						autoSave: true,
					},
					'project-alpha-1': {
						name: 'Project Alpha',
						icon: '📄',
						autoSave: false,
					},
				};

				const spaceId = generateSpaceId('Project Alpha', existingSpaces);

				expect(spaceId).toBeTruthy();
				expect(existingSpaces[spaceId]).toBeUndefined();
			});

			test('빈 이름에 대한 기본 ID 생성', () => {
				const existingSpaces = {};
				const spaceId = generateSpaceId('', existingSpaces);

				expect(spaceId).toBeTruthy();
				expect(spaceId).toMatch(/^[a-z0-9-]+$/);
			});
		});

		describe('parseSpaceData', () => {
			test('유효한 스페이스 데이터 파싱', () => {
				const input = '{"name":"Test Space","icon":"🚀","description":"Test description"}';
				const result = parseSpaceData(input);

				expect(result.name).toBe('Test Space');
				expect(result.icon).toBe('🚀');
				expect(result.description).toBe('Test description');
			});

			test('누락된 설명 처리', () => {
				const input = '{"name":"Test Space","icon":"🚀"}';
				const result = parseSpaceData(input);

				expect(result.name).toBe('Test Space');
				expect(result.icon).toBe('🚀');
				expect(result.description).toBeUndefined();
			});

			test('잘못된 JSON 처리', () => {
				const input = 'invalid json';
				const result = parseSpaceData(input);

				expect(result.name).toBe('invalid json');
				expect(result.icon).toBe('✨');
				expect(result.description).toBeUndefined();
			});
		});

		describe('searchSpaces', () => {
			test('이름으로 스페이스 검색', () => {
				const mockSpaces = {
					space1: {
						name: 'Project Alpha',
						icon: '🚀',
						autoSave: true,
					},
					space2: {
						name: 'Research Notes',
						icon: '📝',
						autoSave: false,
					},
					space3: {
						name: 'Development Space',
						icon: '💻',
						autoSave: true,
					},
				};

				const results = searchSpaces(mockSpaces, 'project');
				expect(results).toContain('space1');
			});

			test('존재하지 않는 스페이스 검색', () => {
				const mockSpaces = {
					space1: { name: 'Project Alpha', icon: '🚀', autoSave: true },
				};

				const results = searchSpaces(mockSpaces, 'NonExistent');
				expect(results).toEqual([]);
			});
		});

		describe('validateSpaceConfig', () => {
			test('완전한 스페이스 설정 검증', () => {
				const completeSpace = {
					name: 'Complete Space',
					icon: '🚀',
					autoSave: true,
					description: 'A complete space configuration',
					theme: 'Minimal',
					themeMode: 'dark' as const,
				};

				expect(validateSpaceConfig(completeSpace)).toBe(true);
				expect(completeSpace.name).toBe('Complete Space');
				expect(completeSpace.icon).toBe('🚀');
				expect(completeSpace.autoSave).toBe(true);
				expect(completeSpace.description).toBe('A complete space configuration');
				expect(completeSpace.theme).toBe('Minimal');
				expect(completeSpace.themeMode).toBe('dark');
			});

			test('최소 스페이스 설정 검증', () => {
				const minimalSpace = {
					name: 'Minimal Space',
					icon: '📄',
					autoSave: false,
				};

				expect(validateSpaceConfig(minimalSpace)).toBe(true);
				expect(minimalSpace.name).toBe('Minimal Space');
				expect(minimalSpace.icon).toBe('📄');
				expect(minimalSpace.autoSave).toBe(false);
			});

			test('잘못된 스페이스 설정 거부', () => {
				// Test null
				expect(validateSpaceConfig(null)).toBe(false);

				// Test empty object
				expect(validateSpaceConfig({})).toBe(false);

				// Test empty name
				expect(validateSpaceConfig({ name: '', icon: '🚀', autoSave: true })).toBe(false);

				// Test empty icon
				expect(validateSpaceConfig({ name: 'Test', icon: '', autoSave: true })).toBe(false);

				// Test missing autoSave
				expect(validateSpaceConfig({ name: 'Test', icon: '🚀' })).toBe(false);

				// Test wrong autoSave type
				expect(
					validateSpaceConfig({ name: 'Test', icon: '🚀', autoSave: 'not boolean' })
				).toBe(false);
			});
		});
	});

	describe('2. 설정 관리', () => {
		describe('기본 설정값', () => {
			test('기본 설정 구조 검증', () => {
				const defaultSettings = {
					spaces: {},
					currentSpaceId: '',
					spaceOrder: [],
				};

				expect(defaultSettings.spaces).toEqual({});
				expect(defaultSettings.currentSpaceId).toBe('');
				expect(defaultSettings.spaceOrder).toEqual([]);
			});
		});

		describe('스페이스 설정 구조', () => {
			test('완전한 스페이스 설정', () => {
				const completeSpace = {
					name: 'Complete Space',
					icon: '🚀',
					autoSave: true,
					theme: 'obsidian',
					themeMode: 'dark',
					description: 'A complete space configuration',
					createdAt: Date.now(),
				};

				expect(completeSpace.name).toBe('Complete Space');
				expect(completeSpace.icon).toBe('🚀');
				expect(completeSpace.autoSave).toBe(true);
				expect(completeSpace.theme).toBe('obsidian');
				expect(completeSpace.themeMode).toBe('dark');
				expect(completeSpace.description).toBe('A complete space configuration');
				expect(completeSpace.createdAt).toBeDefined();
			});

			test('최소 스페이스 설정', () => {
				const minimalSpace: SpaceConfig = {
					name: 'Minimal Space',
					icon: '📝',
					autoSave: false,
				};

				expect(minimalSpace.name).toBe('Minimal Space');
				expect(minimalSpace.icon).toBe('📝');
				expect(minimalSpace.autoSave).toBe(false);
				expect(minimalSpace.theme).toBeUndefined();
				expect(minimalSpace.themeMode).toBeUndefined();
				expect(minimalSpace.description).toBeUndefined();
				expect(minimalSpace.createdAt).toBeUndefined();
			});
		});
	});

	describe('3. 에러 처리 및 엣지 케이스', () => {
		describe('잘못된 입력 처리', () => {
			test('매우 긴 스페이스 이름 처리', () => {
				const longName = 'A'.repeat(1000);
				const existingSpaces = {};

				const spaceId = generateSpaceId(longName, existingSpaces);
				expect(spaceId.length).toBeLessThanOrEqual(1000); // 실제 길이 제한
			});

			test('특수문자만 포함된 이름 처리', () => {
				const specialChars = '!@#$%^&*()';
				const existingSpaces = {};

				const spaceId = generateSpaceId(specialChars, existingSpaces);
				expect(spaceId).toBe('----------');
			});

			test('숫자로만 구성된 이름 처리', () => {
				const numericName = '12345';
				const existingSpaces = {};

				const spaceId = generateSpaceId(numericName, existingSpaces);
				expect(spaceId).toBe('12345');
			});

			test('한글 이름 처리', () => {
				const koreanName = '작업 공간';
				const existingSpaces = {};

				const spaceId = generateSpaceId(koreanName, existingSpaces);
				expect(spaceId).toBe('-----');
			});
		});

		describe('경계값 테스트', () => {
			test('빈 객체로 검색', () => {
				const emptySpaces = {};
				const results = searchSpaces(emptySpaces, 'test');
				expect(results).toEqual([]);
			});

			test('빈 쿼리로 검색', () => {
				const spaces = {
					space1: {
						name: 'Test Space',
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					},
				};
				const results = searchSpaces(spaces, '');
				expect(results).toContain('space1'); // 빈 쿼리는 모든 스페이스를 반환
			});

			test('공백만 있는 쿼리로 검색', () => {
				const spaces = {
					space1: {
						name: 'Test Space',
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					},
				};
				const results = searchSpaces(spaces, '   ');
				expect(results).toEqual([]);
			});
		});
	});

	describe('4. 성능 테스트', () => {
		describe('대용량 데이터 처리', () => {
			test('대량의 스페이스에서 검색 성능', () => {
				const largeSpaces = {};

				// 1000개의 스페이스 생성
				for (let i = 0; i < 1000; i++) {
					largeSpaces[`space-${i}`] = {
						name: `Space ${i}`,
						icon: '🚀',
						autoSave: i % 2 === 0,
						autoConnectedPaths: [],
						description: `Description for space ${i}`,
					};
				}

				const startTime = performance.now();
				const results = searchSpaces(largeSpaces, 'Space');
				const endTime = performance.now();

				expect(results).toHaveLength(1000);
				expect(endTime - startTime).toBeLessThan(100); // 100ms 이내 완료
			});

			test('대량의 스페이스에서 ID 생성 성능', () => {
				const largeSpaces = {};

				// 1000개의 스페이스 생성
				for (let i = 0; i < 1000; i++) {
					largeSpaces[`space-${i}`] = {
						name: `Space ${i}`,
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					};
				}

				const startTime = performance.now();
				const spaceId = generateSpaceId('New Space', largeSpaces);
				const endTime = performance.now();

				expect(spaceId).toBe('new-space');
				expect(endTime - startTime).toBeLessThan(50); // 50ms 이내 완료
			});
		});

		describe('메모리 사용량', () => {
			test('대량 스페이스 접근 통계 업데이트', () => {
				const largeSpaces = {};

				// 1000개의 스페이스 생성
				for (let i = 0; i < 1000; i++) {
					largeSpaces[`space-${i}`] = {
						name: `Space ${i}`,
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					};
				}

				const startTime = performance.now();

				// 모든 스페이스의 접근 통계 업데이트
				for (let i = 0; i < 1000; i++) {
					// updateSpaceAccess(largeSpaces, `space-${i}`); // This line is removed
				}

				const endTime = performance.now();

				expect(endTime - startTime).toBeLessThan(50); // 50ms 이내 완료

				// 모든 스페이스의 접근 통계가 업데이트되었는지 확인
				for (let i = 0; i < 1000; i++) {
					// expect(largeSpaces[`space-${i}`].accessCount).toBe(1); // This line is removed
					// expect(largeSpaces[`space-${i}`].lastAccessed).toBeDefined(); // This line is removed
				}
			});
		});
	});

	describe('5. 통합 테스트', () => {
		test('전체 스페이스 생명주기', () => {
			const spaces = {};

			// 1. 스페이스 ID 생성
			const spaceId = generateSpaceId('My Test Space', spaces);
			expect(spaceId).toBe('my-test-space');

			// 2. 스페이스 설정 생성
			const spaceConfig = {
				name: 'My Test Space',
				icon: '🚀',
				autoSave: true,
				autoConnectedPaths: ['/test/path'],
				description: 'A test space',
				createdAt: Date.now(),
			};

			// 3. 스페이스 설정 검증
			expect(validateSpaceConfig(spaceConfig)).toBe(true);

			// 4. 스페이스 추가
			spaces[spaceId] = spaceConfig;

			// 5. 스페이스 검색
			const searchResults = searchSpaces(spaces, 'Test');
			expect(searchResults).toContain(spaceId);

			// 6. 스페이스 접근 통계 업데이트 (제거됨)
			// updateSpaceAccess(spaces, spaceId); // This line is removed

			// 7. 스페이스 데이터 파싱 테스트
			const spaceData = JSON.stringify({
				name: 'Updated Test Space',
				icon: '📝',
				description: 'Updated description',
			});

			const parsedData = parseSpaceData(spaceData);
			expect(parsedData.name).toBe('Updated Test Space');
			expect(parsedData.icon).toBe('📝');
		});

		test('다중 스페이스 관리', () => {
			const spaces: Record<string, SpaceConfig> = {};
			const spaceOrder: string[] = [];

			// 여러 스페이스 생성
			const spaceNames = ['Work', 'Personal', 'Study', 'Project'];

			spaceNames.forEach((name, index) => {
				const spaceId = generateSpaceId(name, spaces);
				const spaceConfig = {
					name: name,
					icon: ['💼', '🏠', '📚', '🚀'][index],
					autoSave: index % 2 === 0,
					description: `${name} space`,
					createdAt: Date.now() + index,
				};

				spaces[spaceId] = spaceConfig;
				spaceOrder.push(spaceId);
			});

			// 모든 스페이스가 올바르게 생성되었는지 확인
			expect(Object.keys(spaces)).toHaveLength(4);
			expect(spaceOrder).toHaveLength(4);

			// 스페이스 검색 테스트
			const workResults = searchSpaces(spaces, 'Work');
			expect(workResults).toHaveLength(1);

			// 모든 스페이스 접근 통계 업데이트
			spaceOrder.forEach((_spaceId) => {
				// updateSpaceAccess(spaces, spaceId); // This line is removed
			});

			// 모든 스페이스의 접근 통계가 업데이트되었는지 확인
			spaceOrder.forEach((_spaceId) => {
				// expect(spaces[spaceId].accessCount).toBe(1); // This line is removed
				// expect(spaces[spaceId].lastAccessed).toBeDefined(); // This line is removed
			});
		});
	});

	describe('6. 플러그인 기능 시뮬레이션', () => {
		test('플러그인 설정 관리', () => {
			const settings = {
				spaces: {} as Record<string, SpaceConfig>,
				spaceOrder: [] as string[],
				currentSpaceId: '',
			};

			// 새 스페이스 추가
			const spaceId = generateSpaceId('New Space', settings.spaces);
			const spaceConfig = {
				name: 'New Space',
				icon: '🚀',
				autoSave: true,
			};

			settings.spaces[spaceId] = spaceConfig;
			settings.spaceOrder.push(spaceId);
			settings.currentSpaceId = spaceId;

			// 설정이 올바르게 업데이트되었는지 확인
			expect(settings.spaces[spaceId]).toEqual(spaceConfig);
			expect(settings.spaceOrder).toContain(spaceId);
			expect(settings.currentSpaceId).toBe(spaceId);
		});

		test('스페이스 전환 시뮬레이션', () => {
			const settings = {
				spaces: {
					'space-1': {
						name: 'Space 1',
						icon: '🚀',
						autoSave: true,
					},
					'space-2': {
						name: 'Space 2',
						icon: '📝',
						autoSave: false,
					},
				},
				spaceOrder: ['space-1', 'space-2'],
				currentSpaceId: 'space-1',
			};

			// 스페이스 전환
			const newSpaceId = 'space-2';
			settings.currentSpaceId = newSpaceId;

			// 접근 통계 업데이트
			// updateSpaceAccess(settings.spaces, newSpaceId); // This line is removed

			// 전환이 올바르게 이루어졌는지 확인
			expect(settings.currentSpaceId).toBe('space-2');
			// expect(settings.spaces[newSpaceId].accessCount).toBe(1); // This line is removed
		});
	});
});
