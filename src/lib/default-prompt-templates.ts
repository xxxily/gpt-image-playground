import type { PromptTemplate, PromptTemplateCategory } from '@/types/prompt-template';

function template(id: string, name: string, categoryId: string, description: string, prompt: string): PromptTemplate {
    return { id, name, categoryId, description, prompt };
}

export const DEFAULT_PROMPT_TEMPLATE_CATEGORIES: PromptTemplateCategory[] = [
    {
        id: 'style-transfer',
        name: '风格转换',
        description: '覆盖插画、摄影、平面、3D、传统艺术与抽象质感，适合添加源图片后直接改风格。'
    },
    {
        id: 'ecommerce-product',
        name: '电商商品图',
        description: '适合商品主图、详情页、卖点图、场景图和材质展示。'
    },
    {
        id: 'social-media',
        name: '社交媒体内容',
        description: '适合小红书、朋友圈、短视频封面、信息卡片和活动预告。'
    },
    {
        id: 'brand-marketing',
        name: '品牌营销',
        description: '适合广告主视觉、品牌海报、发布会、活动 KV 和概念传播。'
    },
    {
        id: 'food-beverage',
        name: '餐饮美食',
        description: '适合菜单、外卖、饮品、烘焙、节令菜品和餐厅营销。'
    },
    {
        id: 'fashion-beauty',
        name: '时尚美妆',
        description: '适合服装穿搭、护肤彩妆、香氛珠宝和美妆广告。'
    },
    {
        id: 'real-estate-interior',
        name: '地产空间',
        description: '适合室内设计、民宿酒店、商业空间、办公空间和建筑展示。'
    },
    {
        id: 'education-training',
        name: '教育培训',
        description: '适合课程封面、知识图解、儿童启蒙、考试备考和培训海报。'
    },
    {
        id: 'game-concept',
        name: '游戏概念',
        description: '适合角色、道具、场景、关卡、卡牌和 UI 资产概念。'
    },
    {
        id: 'tech-ui',
        name: '科技产品',
        description: '适合 SaaS、AI、硬件、数据看板、智能设备和未来科技视觉。'
    },
    {
        id: 'travel-culture',
        name: '旅行文旅',
        description: '适合目的地海报、城市名片、酒店民宿、节庆文化和路线推广。'
    },
    {
        id: 'health-wellness',
        name: '健康生活',
        description: '适合健身、瑜伽、康养、医疗健康、营养饮食和心理疗愈。'
    },
    {
        id: 'portrait-avatar',
        name: '头像人像',
        description: '适合职业头像、社交头像、角色照、证件感照片和人像氛围。'
    },
    {
        id: 'business-office',
        name: '商务办公',
        description: '适合企业官网、汇报封面、团队协作、招聘、咨询和金融场景。'
    },
    {
        id: 'seasonal-festival',
        name: '节日季节',
        description: '适合传统节日、商业节点、季节主题、节庆海报和活动物料。'
    },
    {
        id: 'texture-background',
        name: '纹理背景',
        description: '适合生成海报背景、PPT 背景、包装底纹、抽象材质和氛围图。'
    }
];

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
    template('style-transfer-watercolor', '水彩插画', 'style-transfer', '柔和纸张纹理、透明水彩边缘和轻盈色彩。', '将这张图片转换为精致的水彩插画风格，保留主体构图与关键细节，加入柔和纸张纹理、自然晕染边缘、轻盈透明的色彩层次。'),
    template('style-transfer-anime', '日系动画', 'style-transfer', '干净线稿、明亮配色和动画电影质感。', '将这张图片转换为高质量日系动画电影风格，保留原始主体和姿态，使用干净线稿、明亮但协调的配色、柔和光影和细腻背景氛围。'),
    template('style-transfer-cinematic', '电影海报', 'style-transfer', '戏剧光影、胶片色彩和海报级构图。', '将这张图片转换为电影海报风格，保留主体识别度，加入戏剧化布光、胶片颗粒、强烈明暗对比、专业调色和具有叙事感的海报级画面。'),
    template('style-transfer-clay', '黏土玩具', 'style-transfer', '手作黏土质感、圆润形体和玩具摄影。', '将这张图片转换为手作黏土玩具风格，保持主体特征，使用圆润柔和的形体、细微手工纹理、哑光材质、微缩摄影布光和温暖可爱的视觉氛围。'),
    template('style-transfer-ink', '水墨国风', 'style-transfer', '留白、墨色层次和宣纸质感。', '将这张图片转换为水墨国风插画，保留主要构图，使用宣纸纹理、自然墨色层次、适度留白、含蓄线条和东方美学的简洁意境。'),
    template('style-transfer-pixel', '像素艺术', 'style-transfer', '复古游戏像素块、限制色板和清晰轮廓。', '将这张图片转换为精致像素艺术风格，保留主体轮廓与关键特征，使用复古游戏限制色板、清晰像素块、简洁高对比阴影和可读性强的细节。'),
    template('style-transfer-oil-painting', '厚涂油画', 'style-transfer', '可见笔触、厚重颜料和古典光影。', '将这张图片转换为厚涂油画风格，保留主体结构，加入可见的油彩笔触、厚重颜料堆叠、柔和明暗过渡和画布纹理。'),
    template('style-transfer-pencil-sketch', '铅笔素描', 'style-transfer', '灰阶线条、明暗排线和纸面质感。', '将这张图片转换为铅笔素描风格，保留主体比例与关键轮廓，使用细腻排线、柔和灰阶阴影、纸张颗粒和手绘草稿感。'),
    template('style-transfer-pen-ink', '钢笔线描', 'style-transfer', '清晰墨线、交叉排线和建筑速写感。', '将这张图片转换为钢笔线描插画，保留轮廓和空间关系，使用清晰黑色墨线、交叉排线阴影、干净留白和手工速写质感。'),
    template('style-transfer-comic', '美式漫画', 'style-transfer', '粗线条、高对比阴影和分镜画面。', '将这张图片转换为美式漫画风格，保留动作和表情，加入粗犷描边、高对比阴影、半色调网点、鲜明色块和分镜式张力。'),
    template('style-transfer-pop-art', '波普艺术', 'style-transfer', '高饱和色块、网点纹理和广告感构图。', '将这张图片转换为波普艺术风格，保留主体识别度，使用高饱和撞色、半色调网点、硬边色块和强烈的平面广告视觉。'),
    template('style-transfer-low-poly', '低多边形', 'style-transfer', '几何切面、平面阴影和现代 3D 感。', '将这张图片转换为低多边形风格，保留主体轮廓，使用清晰几何切面、分面明暗、简洁渐变背景和现代数字雕塑质感。'),
    template('style-transfer-paper-cut', '剪纸拼贴', 'style-transfer', '层叠纸片、阴影边缘和手工立体感。', '将这张图片转换为剪纸拼贴风格，保留主体构图，用多层彩色纸片、细微纸纤维、真实投影和手工裁切边缘表现画面。'),
    template('style-transfer-risograph', '孔版印刷', 'style-transfer', '颗粒油墨、套色偏移和复古印刷。', '将这张图片转换为孔版印刷风格，保留主要形体，使用有限色板、油墨颗粒、轻微套印偏移、纸张纹理和复古独立出版物质感。'),
    template('style-transfer-editorial', '杂志插画', 'style-transfer', '高级配色、留白和现代编辑感。', '将这张图片转换为现代杂志编辑插画风格，保留核心信息，使用克制高级配色、清晰层级、适度留白和适合封面或专栏的视觉表达。'),
    template('style-transfer-neon-cyberpunk', '赛博霓虹', 'style-transfer', '雨夜反光、霓虹边缘和未来都市感。', '将这张图片转换为赛博朋克霓虹风格，保留主体轮廓，加入雨夜反光、紫蓝霓虹、电子屏光晕、潮湿街景质感和未来都市氛围。'),
    template('style-transfer-vaporwave', '蒸汽波', 'style-transfer', '粉紫渐变、复古数码和梦幻怀旧感。', '将这张图片转换为蒸汽波视觉风格，使用粉紫青渐变、复古数码纹理、柔和网格、夕阳球体、低保真怀旧氛围，同时保留主体重点。'),
    template('style-transfer-bauhaus', '包豪斯几何', 'style-transfer', '基础几何、红黄蓝黑和秩序构成。', '将这张图片转换为包豪斯几何构成风格，提炼主体为圆形、矩形和线条，使用红黄蓝黑基础色、清晰网格和理性平面构图。'),
    template('style-transfer-art-deco', '装饰艺术', 'style-transfer', '金色线条、对称构图和奢华复古感。', '将这张图片转换为装饰艺术风格，保留主体中心性，加入对称构图、金色几何线条、深色背景、放射形纹样和复古奢华质感。'),
    template('style-transfer-retro-poster', '复古旅行海报', 'style-transfer', '大色块、颗粒纹理和经典海报排版。', '将这张图片转换为复古旅行海报风格，使用大面积平涂色块、轻微纸张颗粒、简化阴影、醒目的构图和怀旧印刷质感。'),
    template('style-transfer-isometric', '等距 2.5D', 'style-transfer', '微缩场景、等距视角和干净建模。', '将这张图片转换为等距 2.5D 微缩场景风格，保留空间关系，使用等距视角、圆润几何、柔和阴影和清晰可爱的数字模型感。'),
    template('style-transfer-3d-toy', '3D 玩具渲染', 'style-transfer', '圆润形体、塑料材质和产品级灯光。', '将这张图片转换为高质量 3D 玩具渲染风格，保留主体特征，使用圆润比例、细腻塑料或软胶材质、柔和棚拍灯光和干净背景。'),
    template('style-transfer-glassmorphism', '玻璃拟态', 'style-transfer', '磨砂透明、柔和折射和科技感光晕。', '将这张图片转换为玻璃拟态视觉风格，保留主体构成，加入半透明磨砂质感、柔和折射、细腻边缘高光、渐变光晕和现代 UI 氛围。'),
    template('style-transfer-embroidery', '刺绣织物', 'style-transfer', '针脚纹理、布料纤维和手工装饰感。', '将这张图片转换为刺绣织物风格，保留主体轮廓，使用可见针脚、线材光泽、布面纹理、轻微凸起和手工工艺质感。'),
    template('style-transfer-stained-glass', '彩色玻璃', 'style-transfer', '铅线分割、透光色块和教堂窗感。', '将这张图片转换为彩色玻璃风格，保留主体形状，用铅线分割画面，加入半透明彩色玻璃、透光纹理和庄重装饰感。'),
    template('style-transfer-mosaic', '马赛克壁画', 'style-transfer', '小块拼贴、石材纹理和壁画质感。', '将这张图片转换为马赛克壁画风格，保留主体识别度，使用小块陶瓷或石材拼片、细微缝隙、手工不规则边缘和墙面质感。'),
    template('style-transfer-vintage-film', '复古胶片', 'style-transfer', '柔和颗粒、暖色调和模拟摄影质感。', '将这张图片转换为复古胶片摄影风格，保留真实感，加入柔和颗粒、轻微暗角、暖色调、高光泛白和自然镜头质感。'),
    template('style-transfer-black-white', '黑白纪实', 'style-transfer', '高反差、银盐颗粒和街拍纪实感。', '将这张图片转换为黑白纪实摄影风格，保留真实结构，增强明暗对比、银盐颗粒、自然环境光和决定性瞬间的叙事感。'),
    template('style-transfer-fantasy', '奇幻概念', 'style-transfer', '魔法光效、史诗氛围和幻想世界观。', '将这张图片转换为奇幻概念艺术风格，保留主体核心特征，加入魔法光效、史诗级环境、细腻材质、深远空间和幻想世界氛围。'),
    template('style-transfer-sci-fi', '科幻概念', 'style-transfer', '硬表面结构、冷色光效和未来工业感。', '将这张图片转换为科幻概念艺术风格，保留主体功能感，加入硬表面结构、冷色能量光、金属材质、机械细节和未来工业氛围。'),
    template('style-transfer-minimal-flat', '极简扁平', 'style-transfer', '低细节、清晰色块和信息图式表达。', '将这张图片转换为极简扁平插画风格，提炼主体为清晰形状，减少细节噪声，使用有限色板、干净边界和适合信息展示的平面构图。'),
    template('style-transfer-childrens-book', '儿童绘本', 'style-transfer', '柔和粉彩、圆润形体和温暖故事感。', '将这张图片转换为儿童绘本插画风格，保留主体关系，使用柔和粉彩、圆润线条、温暖光线、友善表情和充满故事感的画面。'),
    template('style-transfer-ukiyo-e', '浮世绘版画', 'style-transfer', '平面色块、木版纹理和传统装饰线条。', '将这张图片转换为浮世绘木版画风格，保留主体姿态和构图，使用平面色块、清晰轮廓、纸张与木版印刷纹理、装饰性波纹和传统色彩。'),
    template('style-transfer-botanical', '植物学图鉴', 'style-transfer', '精细线稿、标本排版和自然观察感。', '将这张图片转换为植物学图鉴风格，保留主体细节，使用精细线稿、淡雅上色、标本式留白、局部注释感和自然观察插画质感。'),

    template('ecommerce-white-bg', '纯白主图', 'ecommerce-product', '干净背景、柔和阴影和平台商品主图感。', '生成一张专业电商商品主图：纯白背景，商品居中，边缘清晰，柔和自然投影，高级棚拍灯光，真实材质细节，不出现真实品牌标识和多余文字。'),
    template('ecommerce-lifestyle-scene', '生活方式场景', 'ecommerce-product', '把商品自然放进使用场景，增强购买想象。', '生成一张电商生活方式场景图：商品自然融入真实使用环境，画面干净、有温度，突出商品用途和质感，背景不过度抢眼，适合详情页展示。'),
    template('ecommerce-floating-hero', '悬浮卖点图', 'ecommerce-product', '悬浮构图、卖点分层和高冲击展示。', '生成一张商品悬浮卖点图：主体产品悬浮在画面中心，周围以抽象几何和光效表现核心卖点，构图具有冲击力，背景简洁，适合活动页首屏。'),
    template('ecommerce-premium-dark', '暗调奢华商品', 'ecommerce-product', '深色背景、边缘光和高端质感。', '生成一张暗调奢华商品摄影图：深色哑光背景，产品边缘有精致轮廓光，材质高光克制，构图稳重高级，适合高客单价商品展示。'),
    template('ecommerce-material-macro', '材质微距细节', 'ecommerce-product', '放大纹理、工艺和产品细节。', '生成一张商品材质微距图：聚焦产品局部工艺、纹理、缝线、金属或表面质感，浅景深，细节锐利，光线柔和，适合详情页强调品质。'),
    template('ecommerce-exploded-view', '结构拆解图', 'ecommerce-product', '展示组件、结构和功能层次。', '生成一张产品结构拆解透视图：各组件沿轴线有序分离，展示内部结构和功能层次，背景干净，具有科技说明书质感，不添加不可读文字。'),
    template('ecommerce-seasonal-promo', '季节促销氛围', 'ecommerce-product', '结合季节元素做促销主视觉。', '生成一张季节促销商品图：产品为主角，结合当前季节的自然元素和节日氛围，色彩明快但不杂乱，留出可放促销文案的干净区域。'),
    template('ecommerce-bundle-kit', '套装组合陈列', 'ecommerce-product', '适合多 SKU、礼盒和组合套装。', '生成一张电商套装组合陈列图：多个商品层次分明地排列，主次清晰，包装与配件完整展示，光线统一，适合礼盒、套装或多 SKU 详情页。'),

    template('social-xhs-cover', '小红书封面', 'social-media', '清爽标题区、生活方式氛围和强点击感。', '生成一张小红书风格封面图：画面明亮干净，主体突出，生活方式氛围强，预留醒目的标题区域，色彩柔和但有记忆点，适合种草内容。'),
    template('social-short-video-cover', '短视频封面', 'social-media', '强主体、大对比和移动端可读性。', '生成一张短视频封面：主体占比大，表情或动作有张力，背景简洁高对比，画面在手机小尺寸下依然清晰，预留大标题空间。'),
    template('social-carousel-card', '知识轮播卡片', 'social-media', '适合多页轮播的信息卡风格。', '生成一张知识轮播卡片视觉：信息层级清晰，使用简洁图形、编号模块和柔和背景，适合做系列内容封面或单页知识总结。'),
    template('social-before-after', '前后对比展示', 'social-media', '适合改造、教程、案例和效果展示。', '生成一张前后对比展示图：左右或上下分区明确，突出改变前后的差异，构图干净，适合教程、改造、案例复盘内容。'),
    template('social-event-announcement', '活动预告图', 'social-media', '适合直播、课程、发布会和社群活动。', '生成一张社交媒体活动预告图：主视觉吸引人，预留清晰的信息区，整体有期待感和行动号召氛围，适合直播、课程或社群活动。'),
    template('social-quote-poster', '金句海报', 'social-media', '留白、文字区和情绪氛围。', '生成一张金句海报背景：画面有安静情绪和高级留白，主体简洁，预留大面积文字排版空间，适合放置一句观点或文案。'),
    template('social-vlog-thumbnail', 'Vlog 缩略图', 'social-media', '真实生活、旅行感和轻松氛围。', '生成一张 Vlog 缩略图：画面真实自然，有人物或场景故事感，色彩明亮，构图轻松，适合生活记录、旅行或日常分享。'),
    template('social-community-banner', '社群横幅', 'social-media', '适合社群、活动页和频道头图。', '生成一张社群横幅视觉：横向构图，中心主题明确，背景有轻微图形装饰和氛围层次，左右留出安全边距，适合频道头图或社群活动页。'),

    template('brand-hero-kv', '品牌主视觉 KV', 'brand-marketing', '适合新品、活动和官网首屏。', '生成一张品牌营销主视觉 KV：主体明确，画面有强烈记忆点，构图适合官网首屏或海报，预留品牌标题区域，不出现真实商标。'),
    template('brand-launch-poster', '新品发布海报', 'brand-marketing', '科技感、期待感和发布会氛围。', '生成一张新品发布海报：产品或概念位于中心，背景具有未来感和仪式感，光线聚焦，画面留出发布时间与标题区域，不使用真实品牌元素。'),
    template('brand-campaign-concept', '营销战役概念', 'brand-marketing', '为主题活动生成统一视觉方向。', '生成一张营销战役概念图：围绕一个清晰主题构建象征性视觉，画面具有传播性和统一色彩系统，适合延展为多渠道物料。'),
    template('brand-billboard', '户外广告牌', 'brand-marketing', '远距离可读、强对比和简洁主体。', '生成一张户外广告牌视觉：横向构图，主体大而清晰，背景简洁，高对比，远距离仍可识别，预留短句广告语空间。'),
    template('brand-packaging-mood', '包装视觉方向', 'brand-marketing', '用于包装风格、材质和摆拍方向。', '生成一张品牌包装视觉方向图：展示包装盒、标签和材质氛围，风格统一，光线高级，适合探索包装设计和产品调性。'),
    template('brand-pop-up-store', '快闪店概念', 'brand-marketing', '空间陈列、打卡点和品牌体验。', '生成一张品牌快闪店概念图：空间具有清晰动线和打卡点，陈列突出产品，色彩统一，适合活动策划或体验店提案。'),
    template('brand-social-ad', '社媒广告图', 'brand-marketing', '强 CTA、产品突出和轻量视觉。', '生成一张社媒广告图：产品或服务价值一眼可见，画面干净，留出标题与行动按钮区域，适合投放信息流广告。'),
    template('brand-exhibition-booth', '展会展台设计', 'brand-marketing', '适合展会、路演和品牌展示空间。', '生成一张展会展台视觉：开放式空间，品牌主视觉墙、产品展示台、互动体验区清晰分布，灯光专业，适合商务展览。'),

    template('food-menu-hero', '菜单主图', 'food-beverage', '突出招牌菜和餐厅风格。', '生成一张餐厅菜单主图：招牌菜摆盘诱人，光线温暖自然，背景体现餐厅调性，画面干净，适合菜单首页或外卖店铺头图。'),
    template('food-delivery-listing', '外卖商品图', 'food-beverage', '清晰、真实、食欲感强。', '生成一张外卖商品图：食物居中，份量清楚，色泽真实诱人，背景简洁，光线自然，适合平台列表展示。'),
    template('food-drink-cold', '冰饮清爽感', 'food-beverage', '水珠、冰块和夏日清凉氛围。', '生成一张冰饮广告图：杯身有水珠，冰块通透，背景清爽明亮，加入水果或气泡元素，突出清凉口感和夏日氛围。'),
    template('food-bakery-rustic', '烘焙手作', 'food-beverage', '木桌、面粉和手工温度。', '生成一张烘焙手作场景：面包或甜点刚出炉，木质桌面、面粉、烘焙工具和温暖自然光营造手作质感。'),
    template('food-hotpot-steam', '热锅蒸汽', 'food-beverage', '热气、汤底和聚餐氛围。', '生成一张火锅或热菜场景图：汤底沸腾、蒸汽自然升起、食材丰富，画面有热闹聚餐氛围和强烈食欲感。'),
    template('food-fine-dining', '高级餐厅摆盘', 'food-beverage', '精致留白、盘饰和高级灯光。', '生成一张高级餐厅摆盘摄影：菜品精致居中，盘面留白优雅，灯光克制，背景暗而高级，突出食材层次和料理质感。'),
    template('food-cafe-lifestyle', '咖啡馆生活方式', 'food-beverage', '咖啡、书本、窗光和松弛感。', '生成一张咖啡馆生活方式图：咖啡杯、甜点、书本或电脑自然摆放，窗边柔光，氛围松弛温暖，适合咖啡品牌内容。'),
    template('food-ingredient-flatlay', '食材平铺', 'food-beverage', '适合菜谱、健康餐和食材介绍。', '生成一张食材平铺图：新鲜食材按颜色和类别有序排列，俯拍构图，背景干净，适合菜谱封面、营养科普或食材介绍。'),

    template('fashion-street-style', '街头穿搭', 'fashion-beauty', '城市背景、自然姿态和潮流感。', '生成一张街头穿搭摄影：人物姿态自然，服装层次清晰，城市背景有质感，低角度或抓拍感构图，适合穿搭种草。'),
    template('fashion-lookbook', 'Lookbook 画册', 'fashion-beauty', '高级留白、统一色调和服装展示。', '生成一张时装 Lookbook 图片：模特全身或半身展示服装版型，背景极简，色调统一，构图适合画册和品牌官网。'),
    template('beauty-skincare-ad', '护肤品广告', 'fashion-beauty', '水润质感、成分氛围和洁净背景。', '生成一张护肤品广告图：瓶罐质感清晰，周围加入水滴、植物或成分意象，背景洁净柔和，突出水润、安全和高级感。'),
    template('beauty-makeup-closeup', '妆容特写', 'fashion-beauty', '面部细节、柔光和自然肤质。', '生成一张妆容特写人像：皮肤质感自然，妆容重点清晰，光线柔和，背景干净，适合彩妆教程或美妆产品展示。'),
    template('fashion-jewelry-macro', '珠宝微距', 'fashion-beauty', '宝石火彩、金属反光和奢华质感。', '生成一张珠宝微距广告图：宝石切面和金属细节锐利，背景深色或丝绒质感，光线制造细腻火彩，整体高级奢华。'),
    template('fashion-perfume-mood', '香氛氛围图', 'fashion-beauty', '瓶身、香调意象和轻雾。', '生成一张香氛广告氛围图：香水瓶为主体，周围用花材、木质、柑橘或烟雾表现香调，光线梦幻但克制。'),
    template('fashion-activewear', '运动服装大片', 'fashion-beauty', '动感姿态、肌理和力量感。', '生成一张运动服装大片：人物处于运动姿态，服装剪裁和材质清晰，背景简洁有速度感，光线突出力量和健康。'),
    template('beauty-salon-poster', '美业门店海报', 'fashion-beauty', '适合美甲、美发、护理和门店活动。', '生成一张美业门店海报视觉：画面精致干净，突出服务氛围与效果感，预留活动文字区域，色彩柔和高级，适合线上线下宣传。'),

    template('space-scandinavian-living', '北欧客厅', 'real-estate-interior', '自然木色、柔和采光和舒适感。', '生成一张北欧极简客厅效果图：自然木材、浅色织物、干净线条、柔和窗光和舒适居住氛围，空间通透不过度装饰。'),
    template('space-luxury-hotel', '精品酒店套房', 'real-estate-interior', '高级材质、暖光和度假感。', '生成一张精品酒店套房室内图：床品、灯光、家具和窗景精致协调，色调温暖高级，体现舒适、安静和高端服务感。'),
    template('space-office-modern', '现代办公室', 'real-estate-interior', '开放办公、协作区和科技公司氛围。', '生成一张现代办公室空间图：开放办公区、会议角、绿植和自然采光，材质现代，画面体现高效协作与专业感。'),
    template('space-cafe-interior', '咖啡店空间', 'real-estate-interior', '门店氛围、座位布局和打卡感。', '生成一张咖啡店室内设计图：吧台、座位区、灯光和墙面装饰协调，空间有记忆点，适合门店设计提案或招商展示。'),
    template('space-retail-display', '零售陈列', 'real-estate-interior', '货架、动线和视觉焦点。', '生成一张零售门店陈列空间：商品展示有层次，动线清晰，灯光聚焦主推商品，空间整洁，适合品牌零售和快闪展示。'),
    template('space-real-estate-exterior', '楼盘外立面', 'real-estate-interior', '建筑体量、景观和高端住宅感。', '生成一张地产项目外立面视觉：建筑线条清晰，景观绿化丰富，傍晚柔和灯光，整体体现现代高端住宅品质。'),
    template('space-bedroom-cozy', '温暖卧室', 'real-estate-interior', '床品、灯光和居家舒适感。', '生成一张温暖卧室空间图：柔软床品、床头灯、织物纹理和自然色调，画面安静舒适，适合家居、民宿或软装展示。'),
    template('space-restaurant-dining', '餐厅空间设计', 'real-estate-interior', '桌椅、灯光和用餐体验。', '生成一张餐厅空间设计图：餐桌布局合理，灯光营造氛围，材质与品牌调性统一，画面体现舒适用餐体验。'),

    template('education-course-cover', '课程封面', 'education-training', '清晰主题、专业感和学习动机。', '生成一张在线课程封面：主题明确，视觉专业，图形和背景服务于知识内容，预留课程标题区域，适合教育平台展示。'),
    template('education-knowledge-map', '知识地图', 'education-training', '适合知识体系、章节路线和学习路径。', '生成一张知识地图视觉：用节点、路径和模块表现学习体系，层级清楚，色彩友好，适合课程大纲或学习路线图。'),
    template('education-kids-card', '儿童认知卡', 'education-training', '可爱插画、单一知识点和亲和力。', '生成一张儿童认知卡片：一个核心知识点配一个可爱插画，颜色明亮，形体圆润，画面简单清晰，适合幼儿启蒙。'),
    template('education-science-diagram', '科学图解', 'education-training', '用图形解释科学概念。', '生成一张科学知识图解：用清晰分层、箭头、简洁图形表达一个科学概念，画面专业但易懂，不添加不可读小字。'),
    template('education-exam-poster', '考试备考海报', 'education-training', '时间感、目标感和学习氛围。', '生成一张考试备考海报视觉：书桌、计划表、笔记和晨光营造专注氛围，画面有目标感，适合考研、公考、语言考试等宣传。'),
    template('education-teacher-profile', '讲师介绍图', 'education-training', '专业可信、人物友好和品牌感。', '生成一张讲师介绍主视觉：人物形象专业亲和，背景有知识、课堂或行业元素，构图适合放姓名、头衔和课程信息。'),
    template('education-workshop-event', '线下工作坊', 'education-training', '互动课堂、白板和小组讨论。', '生成一张线下工作坊活动图：学员围坐讨论，白板、便签和材料丰富，气氛积极，适合培训机构或企业内训宣传。'),
    template('education-book-cover', '教育书籍封面', 'education-training', '适合教材、工具书和知识类读物。', '生成一张教育类书籍封面视觉：主题明确，图形简洁有象征性，层级适合放书名和副标题，整体专业、可信、耐看。'),

    template('game-character-concept', '角色概念设定', 'game-concept', '造型、轮廓和性格特征。', '生成一张游戏角色概念图：角色轮廓鲜明，服装与道具体现职业和性格，姿态自然，背景简洁，适合美术设定稿。'),
    template('game-environment-fantasy', '奇幻场景', 'game-concept', '可探索空间、氛围和世界观。', '生成一张奇幻游戏场景概念图：空间层次丰富，有可探索路径、地标建筑、自然元素和神秘光效，适合关卡氛围设定。'),
    template('game-sci-fi-level', '科幻关卡', 'game-concept', '硬表面结构、通道和互动装置。', '生成一张科幻关卡概念图：未来基地或飞船内部，通道、控制台和光源布局清晰，材质硬朗，适合关卡设计参考。'),
    template('game-prop-weapon', '道具武器设定', 'game-concept', '展示功能、材质和可读轮廓。', '生成一张游戏道具或武器设定图：轮廓清晰，展示正面和局部细节，材质与功能可信，背景干净，适合资产制作参考。'),
    template('game-card-illustration', '卡牌插画', 'game-concept', '中心角色、动态构图和稀有度氛围。', '生成一张游戏卡牌插画：主体居中有强动态，背景衬托能力或阵营，光效层次丰富，构图适合卡牌竖版裁切。'),
    template('game-ui-icon-set', '游戏图标组', 'game-concept', '统一风格的技能、物品或成就图标。', '生成一组游戏 UI 图标：统一透视、统一光源和一致描边，图标代表技能、物品或成就，背景透明感强，适合资产库。'),
    template('game-map-overview', '地图俯视图', 'game-concept', '区域分布、路径和地标。', '生成一张游戏地图俯视概念图：区域边界、路径、地标和资源点清晰，具有手绘地图质感，适合世界观或关卡规划。'),
    template('game-boss-arena', 'Boss 战场景', 'game-concept', '中心舞台、危险感和战斗空间。', '生成一张 Boss 战场景概念图：中心战斗区域明确，环境有压迫感和危险元素，光线聚焦关键位置，适合动作或 RPG 关卡设计。'),

    template('tech-saas-hero', 'SaaS 官网首屏', 'tech-ui', '抽象产品能力、数据和现代科技感。', '生成一张 SaaS 官网首屏视觉：抽象展示产品能力、数据流和界面模块，背景现代干净，预留标题和 CTA 区域，不出现真实品牌。'),
    template('tech-ai-assistant', 'AI 助手形象', 'tech-ui', '友好、可信和智能感。', '生成一张 AI 助手视觉形象：具备友好而专业的智能感，光线柔和，背景有数据流或对话界面元素，避免恐怖或压迫感。'),
    template('tech-dashboard', '数据仪表盘', 'tech-ui', '图表模块、层级和可视化氛围。', '生成一张现代数据仪表盘视觉：多个图表卡片、趋势线、关键指标和地图或表格模块有序排列，深色或浅色科技风，层级清晰。'),
    template('tech-hardware-render', '硬件产品渲染', 'tech-ui', '工业设计、材质和未来感。', '生成一张科技硬件产品渲染图：设备外观简洁，材质细腻，边缘光突出轮廓，背景干净，有未来工业设计感。'),
    template('tech-smart-home', '智能家居场景', 'tech-ui', '设备融入家庭生活，光效克制。', '生成一张智能家居场景图：设备自然融入客厅或卧室，局部状态灯和界面提示克制，画面温暖、安全、易用。'),
    template('tech-cybersecurity', '网络安全视觉', 'tech-ui', '盾牌、数据、加密和可信感。', '生成一张网络安全主题视觉：抽象盾牌、数据网格、加密节点和冷色光效，整体专业可信，适合安全产品官网或报告封面。'),
    template('tech-cloud-infra', '云基础设施', 'tech-ui', '服务器、网络和云端架构。', '生成一张云基础设施概念图：数据中心、云节点、网络连线和服务模块构成清晰，画面有规模感和稳定性，适合技术方案介绍。'),
    template('tech-mobile-app-mockup', '移动应用样机', 'tech-ui', '手机屏幕、界面层和产品展示。', '生成一张移动应用产品样机：多台手机或单台手机展示现代 App 界面，背景干净，突出界面层级和产品价值，适合官网或应用商店宣传。'),

    template('travel-destination-poster', '目的地海报', 'travel-culture', '地标、自然景观和旅行向往感。', '生成一张旅行目的地海报：突出当地地标或自然景观，色彩有地域特色，构图开阔，预留标题区，激发旅行向往。'),
    template('travel-city-card', '城市名片', 'travel-culture', '浓缩城市地标、街景和文化符号。', '生成一张城市名片视觉：融合城市天际线、代表性街景、文化符号和当地色彩，画面统一而不拥挤，适合文旅推广。'),
    template('travel-hotel-resort', '度假酒店推广', 'travel-culture', '泳池、海景、房间和松弛感。', '生成一张度假酒店推广图：无边泳池、海景、房间露台或休闲设施自然呈现，光线温暖，画面体现放松和高品质服务。'),
    template('travel-local-market', '地方市集烟火气', 'travel-culture', '摊位、人流、美食和真实生活。', '生成一张地方市集旅行图：摊位灯光、食物、行人和街巷细节丰富，氛围真实热闹，适合城市探索或文旅内容。'),
    template('travel-route-map', '旅行路线图', 'travel-culture', '路线节点、交通和行程感。', '生成一张旅行路线视觉图：用地图、路线、地点节点和图标表达行程规划，风格友好清晰，适合攻略封面或路线推荐。'),
    template('travel-cultural-festival', '民俗节庆', 'travel-culture', '服饰、灯火、仪式和地域文化。', '生成一张民俗节庆场景图：当地服饰、灯火、表演或仪式自然呈现，画面尊重文化语境，氛围热烈且真实。'),
    template('travel-outdoor-adventure', '户外探险', 'travel-culture', '山野、徒步和开阔空间。', '生成一张户外探险旅行图：徒步者、山脉、森林或峡谷形成开阔空间，光线富有方向感，体现自由、挑战和自然壮阔。'),
    template('travel-museum-culture', '博物馆文化', 'travel-culture', '展陈、文物和安静观展氛围。', '生成一张博物馆文化场景：展厅空间、文物陈列和观众剪影有序呈现，灯光克制，画面体现知识、历史和安静审美。'),

    template('wellness-yoga-sunrise', '晨间瑜伽', 'health-wellness', '日出、呼吸感和身心平衡。', '生成一张晨间瑜伽视觉：人物在自然环境或明亮空间中舒展，日出柔光，画面安静、平衡、有呼吸感。'),
    template('wellness-fitness-energy', '健身动感', 'health-wellness', '力量训练、运动轨迹和积极状态。', '生成一张健身训练图：人物动作有力量和速度，汗水、粉尘或光线增强动感，背景简洁，体现健康积极状态。'),
    template('wellness-meditation-room', '冥想疗愈空间', 'health-wellness', '柔光、香薰、坐垫和宁静氛围。', '生成一张冥想疗愈空间图：坐垫、植物、香薰和柔和自然光构成安静场景，色调温暖低饱和，适合心理疗愈或身心课程。'),
    template('wellness-healthy-meal', '健康餐平铺', 'health-wellness', '营养均衡、色彩丰富和清爽饮食。', '生成一张健康餐平铺图：谷物、蔬菜、水果、蛋白质和饮品搭配均衡，俯拍构图，色彩清爽，适合营养科普或餐饮内容。'),
    template('wellness-medical-trust', '医疗健康可信视觉', 'health-wellness', '专业、洁净和温和关怀。', '生成一张医疗健康可信视觉：医生、护士、设备或抽象健康符号以温和专业方式呈现，背景洁净，避免夸张治疗承诺。'),
    template('wellness-sleep-care', '睡眠改善氛围', 'health-wellness', '夜晚、床品、静谧和放松感。', '生成一张睡眠改善主题图：柔软床品、夜灯、安静窗景和低饱和色调，画面传达放松、安稳和恢复感。'),
    template('wellness-outdoor-running', '户外跑步', 'health-wellness', '晨光、路线和自我挑战。', '生成一张户外跑步视觉：跑者在公园、山路或城市清晨中前进，光线积极，画面体现坚持、健康和轻盈动感。'),
    template('wellness-spa-retreat', '温泉 SPA', 'health-wellness', '水汽、石材、植物和疗愈度假感。', '生成一张温泉或 SPA 疗愈场景：水汽、石材、植物、毛巾和柔光构成安静空间，体现放松、高级和自然疗愈感。'),

    template('portrait-professional-headshot', '职业头像', 'portrait-avatar', '干净背景、可信气质和商务用途。', '生成一张职业头像：人物表情自然自信，背景简洁，光线柔和专业，服装得体，适合简历、LinkedIn 或企业官网。'),
    template('portrait-social-avatar', '社交头像', 'portrait-avatar', '鲜明个性、友好表情和识别度。', '生成一张社交媒体头像：人物或角色表情友好，背景有个性但不杂乱，色彩有记忆点，头像小尺寸下仍清晰。'),
    template('portrait-character-avatar', '角色头像', 'portrait-avatar', '适合虚拟形象、播客和社区账号。', '生成一张虚拟角色头像：五官和轮廓清晰，服饰体现性格，背景简洁，风格统一，适合社区账号或个人 IP。'),
    template('portrait-editorial', '杂志人像', 'portrait-avatar', '高级光影、姿态和封面感。', '生成一张杂志风人像：人物姿态自然有力量，光影高级，背景和服装协调，构图适合封面或人物专访。'),
    template('portrait-corporate-team', '团队成员照', 'portrait-avatar', '统一背景、企业感和亲和力。', '生成一张企业团队成员头像风格图：背景统一，人物自然微笑，光线柔和，整体专业可信，适合团队介绍页面。'),
    template('portrait-fantasy-profile', '幻想角色肖像', 'portrait-avatar', '角色设定、服饰和世界观。', '生成一张幻想角色肖像：人物服饰、道具和背景体现世界观，面部清晰，光线有戏剧感，适合角色设定或头像。'),
    template('portrait-black-white', '黑白质感人像', 'portrait-avatar', '高反差、情绪和经典肖像感。', '生成一张黑白质感人像：保留自然肤质和表情，使用高反差光影、简洁背景和经典肖像构图，适合成熟稳重形象。'),
    template('portrait-id-clean', '证件感清爽照', 'portrait-avatar', '正面、清晰、自然但不死板。', '生成一张清爽证件感头像：人物正面或轻微侧身，背景纯净，表情自然，光线均匀，整体正式但不僵硬。'),

    template('business-report-cover', '商业报告封面', 'business-office', '适合年报、行业研究和咨询报告。', '生成一张商业报告封面背景：抽象数据、城市、行业符号或几何图形构成专业视觉，留出标题区域，色调稳重可信。'),
    template('business-consulting-strategy', '咨询战略图', 'business-office', '高层汇报、战略方向和结构化表达。', '生成一张咨询战略主题视觉：棋盘、路线、组织结构或增长曲线以抽象方式呈现，画面简洁专业，适合高层汇报封面。'),
    template('business-team-collab', '团队协作', 'business-office', '会议、白板和跨部门合作。', '生成一张团队协作办公场景：多人围绕白板或桌面讨论，氛围专业积极，画面体现协作、决策和执行力。'),
    template('business-finance-dashboard', '金融数据', 'business-office', '图表、市场、风险和稳健感。', '生成一张金融数据主题视觉：抽象图表、市场趋势线、网格和深色背景，画面专业稳健，适合财经报告或风控内容。'),
    template('business-recruitment', '招聘雇主品牌', 'business-office', '年轻团队、办公环境和成长机会。', '生成一张招聘雇主品牌视觉：明亮办公环境、团队互动和成长氛围，画面积极可信，适合招聘海报或职位页面。'),
    template('business-remote-work', '远程办公', 'business-office', '居家工作、视频会议和灵活协作。', '生成一张远程办公场景：电脑、视频会议、舒适桌面和自然光，画面体现高效、灵活和现代工作方式。'),
    template('business-event-stage', '商务活动舞台', 'business-office', '发布会、峰会和论坛主视觉。', '生成一张商务活动舞台图：大型屏幕、演讲台、观众席和灯光氛围清晰，适合峰会、发布会或行业论坛宣传。'),
    template('business-customer-success', '客户成功场景', 'business-office', '服务、沟通和可信合作关系。', '生成一张客户成功或商务服务场景：顾问与客户沟通，界面或资料辅助说明，画面体现信任、专业和长期合作。'),

    template('seasonal-spring', '春日上新', 'seasonal-festival', '花朵、浅色和轻盈生机。', '生成一张春日上新主题图：花朵、新芽、柔和阳光和浅色背景，画面轻盈清新，适合新品、活动或季节营销。'),
    template('seasonal-summer', '夏日清凉', 'seasonal-festival', '冰块、水波、阳光和明亮色彩。', '生成一张夏日清凉主题图：水波、冰块、阳光、热带植物和明亮色彩构成清爽氛围，适合饮品、旅行或活动海报。'),
    template('seasonal-autumn', '秋日暖调', 'seasonal-festival', '枫叶、木质、金色阳光和收获感。', '生成一张秋日暖调主题图：枫叶、木质纹理、金色阳光和温暖色彩，画面有收获与舒适氛围。'),
    template('seasonal-winter', '冬日雪景', 'seasonal-festival', '雪、暖光、围巾和安静氛围。', '生成一张冬日雪景主题图：雪花、暖色灯光、织物和安静街景或室内场景，适合冬季促销或节日内容。'),
    template('festival-spring-festival', '春节喜庆', 'seasonal-festival', '红金配色、灯笼和团圆氛围。', '生成一张春节主题视觉：红金配色、灯笼、窗花、烟火或团圆餐桌元素，画面喜庆但高级，预留祝福文字区域。'),
    template('festival-mid-autumn', '中秋月夜', 'seasonal-festival', '圆月、月饼、桂花和团圆感。', '生成一张中秋主题视觉：圆月、月饼、桂花、庭院或湖面倒影，画面安静雅致，传达团圆与东方节日氛围。'),
    template('festival-christmas', '圣诞暖夜', 'seasonal-festival', '雪夜、橱窗、灯串和礼物。', '生成一张圣诞主题视觉：温暖灯串、礼物、雪夜橱窗或壁炉场景，色彩温馨，适合节日活动或品牌祝福。'),
    template('festival-new-year-countdown', '跨年倒计时', 'seasonal-festival', '烟火、城市夜景和期待感。', '生成一张跨年倒计时视觉：城市夜景、烟火、光轨和人群剪影，画面有庆祝与期待感，适合新年活动海报。'),

    template('texture-mesh-gradient', '网格渐变背景', 'texture-background', '柔和多色渐变，适合科技和海报背景。', '生成一张抽象网格渐变背景：多种协调色彩柔和融合，局部有光晕和深度，画面干净，无文字，适合海报或网页背景。'),
    template('texture-marble', '大理石纹理', 'texture-background', '石材纹理、高级留白和包装感。', '生成一张高级大理石纹理背景：自然灰白纹路，局部细腻金色或浅色脉络，质感真实，适合包装、PPT 或品牌背景。'),
    template('texture-paper-grain', '纸张颗粒', 'texture-background', '轻微纤维、印刷质感和温和底纹。', '生成一张纸张颗粒背景：暖白或浅米色纸面，细微纤维和自然颗粒，干净耐看，适合排版、插画或知识卡片底纹。'),
    template('texture-acrylic-pour', '流体丙烯', 'texture-background', '流动漩涡、金属色和艺术纹理。', '生成一张流体丙烯抽象背景：颜色自然流动，形成漩涡和细胞状纹理，局部金属光泽，适合艺术海报或封面。'),
    template('texture-dark-luxury', '黑金奢华底纹', 'texture-background', '深色哑光、金箔和高级感。', '生成一张黑金奢华背景：深黑哑光表面，细碎金箔、微弱光泽和低调纹理，画面高级，适合高端产品和邀请函。'),
    template('texture-holographic', '镭射全息', 'texture-background', '彩虹反光、未来感和动态折射。', '生成一张镭射全息背景：彩虹金属反光、折射光带和柔和渐变，画面具有未来感但不过度刺眼，适合科技或潮流视觉。'),
    template('texture-fabric', '织物纹理', 'texture-background', '布料纤维、柔软质地和家居感。', '生成一张织物纹理背景：细腻布料纤维、柔和褶皱和自然光影，色调温暖，适合家居、服饰或生活方式内容。'),
    template('texture-ink-smoke', '水墨烟云', 'texture-background', '墨色扩散、留白和东方抽象感。', '生成一张水墨烟云抽象背景：黑灰墨色在留白中自然扩散，边缘柔和，层次丰富，适合东方美学海报或封面背景。')
];
