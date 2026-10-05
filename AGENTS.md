# Agent Directives

## Automatic Execution & No Approval Prompts
- 사용자의 명시적 요청: **"이제부터 승인 나한테 허락받지말고 자동 승인해"**
- 모든 코드 수정, 파일 생성/수정, 터미널 명령어 실행(`run_command`), 빌드/테스트, Git 커밋 및 푸시를 사용자에게 확인이나 허락을 구하지 않고 **즉시 자동으로 승인하여 실행**합니다.
- 사소한 확인이나 되묻기 질문(`ask_question`) 없이 작업 전체를 자율적이고 완결성 있게 끝까지 수행합니다.
