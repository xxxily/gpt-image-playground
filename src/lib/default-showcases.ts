import { SHOWCASE_CATALOG_SCHEMA_VERSION } from './showcase';
import type { ShowcaseAsset, ShowcaseCase, ShowcaseCatalog, ShowcaseTopic } from './showcase';
import { SHOWCASE_RECIPE_VERSION } from './showcase-recipe';
import type {
    ShowcaseInputRole,
    ShowcaseInputSlot,
    ShowcaseLocalizedText,
    ShowcaseOutputBackground,
    ShowcaseOutputFormat,
    ShowcaseOutputQuality,
    ShowcasePromptStrategy,
    ShowcaseRecipeV1
} from './showcase-recipe';

const GENERATED_AT = Date.UTC(2026, 7, 3, 0, 0, 0);

type DefaultCaseSpec = {
    slug: string;
    title: ShowcaseLocalizedText;
    objective: ShowcaseLocalizedText;
    prompt: ShowcaseLocalizedText;
    slots: ShowcaseInputSlot[];
    difficulty?: ShowcaseCase['difficulty'];
    promptStrategy?: ShowcasePromptStrategy;
    size?: string;
    quality?: ShowcaseOutputQuality;
    outputFormat?: ShowcaseOutputFormat;
    background?: ShowcaseOutputBackground;
};

type DefaultTopicSpec = {
    id: string;
    title: ShowcaseLocalizedText;
    summary: ShowcaseLocalizedText;
    preparation: ShowcaseLocalizedText;
    limitations: ShowcaseLocalizedText;
    tags: ShowcaseLocalizedText[];
    cases: DefaultCaseSpec[];
};

type PlaceholderPalette = {
    inputBackground: string;
    inputForeground: string;
    outputBackground: string;
    outputForeground: string;
};

const PLACEHOLDER_PALETTES: PlaceholderPalette[] = [
    {
        inputBackground: '#E8EDF2',
        inputForeground: '#334155',
        outputBackground: '#DCECE2',
        outputForeground: '#1F5132'
    },
    {
        inputBackground: '#F3E7EC',
        inputForeground: '#6B3149',
        outputBackground: '#E4EBF5',
        outputForeground: '#294A73'
    },
    {
        inputBackground: '#F2E9D8',
        inputForeground: '#624B22',
        outputBackground: '#E4E1F0',
        outputForeground: '#443A69'
    },
    {
        inputBackground: '#E6EEF0',
        inputForeground: '#244C52',
        outputBackground: '#F3E5D8',
        outputForeground: '#6A3D22'
    },
    {
        inputBackground: '#ECECEC',
        inputForeground: '#3F3F46',
        outputBackground: '#DDEBED',
        outputForeground: '#24505A'
    },
    {
        inputBackground: '#E9E4E1',
        inputForeground: '#55433C',
        outputBackground: '#E2E9E3',
        outputForeground: '#2C4E35'
    }
];

function text(zhCN: string, enUS: string): ShowcaseLocalizedText {
    return { 'zh-CN': zhCN, 'en-US': enUS };
}

function imageSlot(
    id: string,
    role: ShowcaseInputRole,
    label: ShowcaseLocalizedText,
    description: ShowcaseLocalizedText,
    workbenchOrder: number,
    required = true
): ShowcaseInputSlot {
    return {
        id,
        label,
        description,
        role,
        required,
        minCount: required ? 1 : 0,
        maxCount: 1,
        workbenchOrder,
        acceptedMimeTypes: ['image/*']
    };
}

function oldPhotoSlot(): ShowcaseInputSlot {
    return imageSlot(
        'old-photo',
        'target',
        text('老照片', 'Old photo'),
        text(
            '上传完整扫描或翻拍图，尽量避免反光、裁切和二次滤镜。',
            'Use a complete scan or capture without glare, cropping, or added filters.'
        ),
        0
    );
}

function targetImageSlot(label = text('主体图片', 'Subject image')): ShowcaseInputSlot {
    return imageSlot(
        'target',
        'target',
        label,
        text(
            '主体应清晰、无遮挡，并保留需要继续识别的边缘和细节。',
            'Keep the subject clear and unobstructed, with important edges and details visible.'
        ),
        0
    );
}

function personSlot(): ShowcaseInputSlot {
    return imageSlot(
        'person',
        'person',
        text('人物照片', 'Person photo'),
        text(
            '使用正面或轻微侧身照片，身体轮廓清晰且不要被大面积遮挡。',
            'Use a front or slight three-quarter view with a clear, unobstructed body outline.'
        ),
        0
    );
}

function garmentSlot(): ShowcaseInputSlot {
    return imageSlot(
        'garment',
        'garment',
        text('服装图片', 'Garment image'),
        text(
            '服装主体需完整、清晰，纯净背景更利于识别版型和材质。',
            'Show the full garment clearly; a clean background helps preserve cut and material cues.'
        ),
        1
    );
}

function productSlot(): ShowcaseInputSlot {
    return imageSlot(
        'product',
        'product',
        text('商品图片', 'Product image'),
        text(
            '商品应完整清晰，Logo、标签和结构细节尽量可辨认。',
            'Keep the full product, logo, labels, and structural details clearly visible.'
        ),
        0
    );
}

function styleReferenceSlot(order = 1): ShowcaseInputSlot {
    return imageSlot(
        'style-reference',
        'style-reference',
        text('风格参考', 'Style reference'),
        text(
            '可选参考图只用于构图、色调或光线方向，不应替代主体内容。',
            'The optional reference guides composition, palette, or lighting without replacing the subject.'
        ),
        order,
        false
    );
}

function makeCase(
    topic: DefaultTopicSpec,
    topicIndex: number,
    caseSpec: DefaultCaseSpec,
    caseIndex: number,
    assets: ShowcaseAsset[]
): ShowcaseCase {
    const id = `${topic.id}-${caseSpec.slug}`;
    const palette = PLACEHOLDER_PALETTES[topicIndex % PLACEHOLDER_PALETTES.length];
    const inputAssetIds = caseSpec.slots.map((slot, slotIndex) => {
        const assetId = `${id}-input-${slot.id}`;
        assets.push({
            id: assetId,
            kind: 'placeholder',
            alt: text(
                `${caseSpec.title['zh-CN']}的${slot.label['zh-CN']}示例占位预览，非真实生成素材。`,
                `Sample placeholder preview for the ${slot.label['en-US']} used by ${caseSpec.title['en-US']}; not an actual generated asset.`
            ),
            placeholder: {
                label: text(
                    `${slot.label['zh-CN']}示例占位 ${slotIndex + 1}`,
                    `${slot.label['en-US']} sample placeholder ${slotIndex + 1}`
                ),
                backgroundColor: palette.inputBackground,
                foregroundColor: palette.inputForeground
            }
        });
        return assetId;
    });

    const outputAssetId = `${id}-output`;
    assets.push({
        id: outputAssetId,
        kind: 'placeholder',
        alt: text(
            `${caseSpec.title['zh-CN']}的期望输出示例占位预览，非真实 AI 生成素材。`,
            `Sample placeholder preview for the expected ${caseSpec.title['en-US']} output; not an actual AI-generated asset.`
        ),
        placeholder: {
            label: text('期望输出示例占位', 'Expected output sample placeholder'),
            backgroundColor: palette.outputBackground,
            foregroundColor: palette.outputForeground
        }
    });

    const recipe: ShowcaseRecipeV1 = {
        version: SHOWCASE_RECIPE_VERSION,
        taskMode: 'image-edit',
        promptStrategy: caseSpec.promptStrategy ?? 'replace',
        prompt: caseSpec.prompt,
        inputSlots: caseSpec.slots,
        capabilityRequirements: {
            supportsEditing: true,
            minReferenceImages: caseSpec.slots.reduce((total, slot) => total + slot.minCount, 0),
            supportedTaskModes: ['image-edit']
        },
        output: {
            n: 1,
            size: caseSpec.size ?? '1024x1024',
            quality: caseSpec.quality ?? 'high',
            outputFormat: caseSpec.outputFormat ?? 'png',
            background: caseSpec.background ?? 'auto',
            moderation: 'auto'
        },
        userInstruction: {
            enabled: true,
            maxLength: 500
        }
    };

    return {
        id,
        topicId: topic.id,
        slug: caseSpec.slug,
        title: caseSpec.title,
        summary: text(
            `通过可审查的图片编辑配方实现：${caseSpec.objective['zh-CN']}`,
            `A reviewable image-edit recipe for ${caseSpec.objective['en-US']}`
        ),
        resultExplanation: text(
            `示例占位输出用于说明预期方向：${caseSpec.objective['zh-CN']}实际结果会随输入图片和模型能力变化。`,
            `The sample placeholder illustrates the intended direction: ${caseSpec.objective['en-US']} Actual results vary with the source images and model capabilities.`
        ),
        inputGuidance: text(
            caseSpec.slots.map((slot) => slot.description['zh-CN']).join(' '),
            caseSpec.slots.map((slot) => slot.description['en-US']).join(' ')
        ),
        cautions: topic.limitations,
        difficulty: caseSpec.difficulty ?? 'beginner',
        sortOrder: (topicIndex + 1) * 100 + (caseIndex + 1) * 10,
        coverAssetId: outputAssetId,
        inputAssetIds,
        outputAssetIds: [outputAssetId],
        recipe
    };
}

const DEFAULT_TOPIC_SPECS: DefaultTopicSpec[] = [
    {
        id: 'old-photo-restoration',
        title: text('老照片修复', 'Old Photo Restoration'),
        summary: text(
            '修复划痕、褪色、噪点和清晰度，同时尽量保留人物身份与年代特征。',
            'Repair scratches, fading, noise, and clarity while preserving identity and period details.'
        ),
        preparation: text(
            '准备一张尽可能完整的扫描或翻拍老照片；原始分辨率越高，越容易核对细节。',
            'Prepare the most complete scan or capture available; higher source resolution makes detail review easier.'
        ),
        limitations: text(
            'AI 可能推断缺失的五官、服饰或年代细节。重要照片应与原件对照，不应用于替代历史事实。',
            'AI may infer missing faces, clothing, or period details. Compare important images with the original and do not treat reconstructions as historical fact.'
        ),
        tags: [text('修复', 'Restoration'), text('老照片', 'Old photos'), text('单图编辑', 'Single-image edit')],
        cases: [
            {
                slug: 'scratch-removal',
                title: text('去除划痕与污渍', 'Remove Scratches and Stains'),
                objective: text(
                    '清理表面划痕、折痕和污渍，同时保持面部、文字与背景结构。',
                    'removing surface scratches, creases, and stains while preserving faces, text, and background structure.'
                ),
                prompt: text(
                    '修复这张老照片。去除划痕、折痕、灰尘和污渍，恢复连续的纹理与边缘；保留人物身份、表情、服饰、背景构图和原有文字，不添加原图不存在的物体。',
                    'Restore this old photograph. Remove scratches, creases, dust, and stains, rebuilding continuous texture and edges. Preserve identity, expression, clothing, composition, and existing text; do not add objects absent from the source.'
                ),
                slots: [oldPhotoSlot()]
            },
            {
                slug: 'faded-tone-recovery',
                title: text('褪色与偏色修复', 'Recover Faded Tones'),
                objective: text(
                    '校正褪色和色偏，恢复自然层次但保留原照片的年代质感。',
                    'correcting fading and color casts while retaining the photograph’s period character.'
                ),
                prompt: text(
                    '校正这张老照片的褪色、发黄和局部色偏，恢复平衡的亮度、对比度和自然肤色。保留胶片颗粒与年代质感，避免过度饱和、塑料质感或现代滤镜。',
                    'Correct fading, yellowing, and local color casts in this old photo. Restore balanced brightness, contrast, and natural skin tones while retaining film grain and period character. Avoid oversaturation, plastic skin, or modern filters.'
                ),
                slots: [oldPhotoSlot()]
            },
            {
                slug: 'clarity-recovery',
                title: text('降噪与清晰增强', 'Denoise and Recover Clarity'),
                objective: text(
                    '降低扫描噪点和轻微模糊，使主体边缘更清楚且不过度锐化。',
                    'reducing scan noise and mild blur while improving edges without aggressive sharpening.'
                ),
                prompt: text(
                    '降低这张老照片的扫描噪点、压缩痕迹和轻微模糊，恢复眼睛、头发、衣物和环境中的真实边缘。保持自然颗粒，不制造虚假的微小细节，不改变人物身份。',
                    'Reduce scan noise, compression artifacts, and mild blur in this old photo. Recover truthful edges in eyes, hair, clothing, and surroundings. Retain natural grain, avoid invented micro-detail, and preserve identity.'
                ),
                slots: [oldPhotoSlot()]
            },
            {
                slug: 'natural-colorization',
                title: text('黑白照片自然上色', 'Natural Black-and-White Colorization'),
                objective: text(
                    '为黑白照片添加克制、符合场景的颜色，并保留原始明暗关系。',
                    'adding restrained, scene-appropriate color while preserving the original tonal structure.'
                ),
                prompt: text(
                    '为这张黑白老照片自然上色。依据材质、光线和年代线索选择克制的肤色、服装与环境颜色，保留原始明暗、颗粒和人物身份。对无法确定的颜色使用中性方案，不夸大饱和度。',
                    'Colorize this black-and-white photograph naturally. Use material, lighting, and period cues for restrained skin, clothing, and environment colors. Preserve original luminance, grain, and identity; use neutral choices where color is uncertain.'
                ),
                slots: [oldPhotoSlot()],
                difficulty: 'intermediate'
            }
        ]
    },
    {
        id: 'virtual-try-on',
        title: text('虚拟试衣间', 'Virtual Try-On'),
        summary: text(
            '按明确的图片顺序组合人物与服装参考，预览不同穿搭方向。',
            'Combine person and garment references in a defined order to preview outfit directions.'
        ),
        preparation: text(
            '准备一张轮廓清晰的人物照片和一张完整服装商品图；复杂造型可再提供一张风格参考。',
            'Prepare a clear person photo and a complete garment image; complex looks may add an optional style reference.'
        ),
        limitations: text(
            '结果仅用于视觉预览，不代表真实尺码、剪裁、材质垂坠或购买效果。人物身份和服装细节都需人工核对。',
            'Results are visual previews only and do not represent real sizing, fit, drape, or purchase outcomes. Review identity and garment details manually.'
        ),
        tags: [text('穿搭', 'Fashion'), text('多图编辑', 'Multi-image edit'), text('人物', 'Portrait')],
        cases: [
            {
                slug: 'casual-top',
                title: text('日常上衣试穿', 'Casual Top Try-On'),
                objective: text(
                    '把参考上衣自然穿到人物身上，保持脸部、姿态和服装关键设计。',
                    'placing the reference top naturally on the person while preserving face, pose, and key garment design.'
                ),
                prompt: text(
                    '将第二张图中的上衣自然穿到第一张图的人物身上。保持人物脸部、发型、姿态、体型和背景；准确保留上衣的领口、袖型、图案、Logo 与配色，并让褶皱、遮挡和光影符合原场景。',
                    'Dress the person in the first image with the top from the second image. Preserve face, hair, pose, body shape, and background. Retain neckline, sleeves, pattern, logo, and colors, with folds, occlusion, and lighting consistent with the scene.'
                ),
                slots: [personSlot(), garmentSlot()],
                size: '864x1152',
                difficulty: 'intermediate'
            },
            {
                slug: 'outerwear-layering',
                title: text('外套叠穿预览', 'Outerwear Layering Preview'),
                objective: text(
                    '添加外套并保留内搭、姿态和合理的层次遮挡。',
                    'adding outerwear with believable layering while retaining the inner outfit and pose.'
                ),
                prompt: text(
                    '把第二张图中的外套穿到第一张图的人物身上，保留可见的原内搭并建立合理叠穿层次。准确还原门襟、领型、口袋、长度和材质，处理手臂与身体遮挡，保持人物身份和原场景光线。',
                    'Place the outerwear from the second image on the person in the first image while retaining visible inner layers. Reproduce closure, collar, pockets, length, and material, with correct arm and body occlusion. Preserve identity and scene lighting.'
                ),
                slots: [personSlot(), garmentSlot()],
                size: '864x1152',
                difficulty: 'intermediate'
            },
            {
                slug: 'formal-look',
                title: text('礼服与正式造型', 'Formal Outfit Preview'),
                objective: text(
                    '预览正式服装的整体轮廓、长度和光泽，同时保持人物自然比例。',
                    'previewing formal clothing silhouette, length, and sheen with natural body proportions.'
                ),
                prompt: text(
                    '将第二张图中的正式服装应用到第一张图人物。保持人物身份、发型、姿态和身体比例，准确保留服装轮廓、领口、腰线、长度、纹理与装饰。让布料光泽、褶皱和阴影与原照片光线一致。',
                    'Apply the formal garment from the second image to the person in the first. Preserve identity, hair, pose, and proportions. Retain silhouette, neckline, waist, length, texture, and embellishments, matching fabric sheen, folds, and shadows to the source lighting.'
                ),
                slots: [personSlot(), garmentSlot()],
                size: '864x1152',
                difficulty: 'advanced'
            },
            {
                slug: 'street-style',
                title: text('街拍风格造型', 'Street-Style Look'),
                objective: text(
                    '组合人物、服装与可选风格参考，形成可信的街拍氛围。',
                    'combining person, garment, and optional style reference into a credible street-style presentation.'
                ),
                prompt: text(
                    '把第二张图服装自然应用到第一张图人物，并参考第三张图的构图、色调和街拍光线。保持人物身份、服装设计和身体比例，不复制第三张图中的人物或品牌；让环境透视、接触阴影和整体色彩统一。',
                    'Apply the garment from the second image to the person in the first, using the third image only for composition, palette, and street-photography lighting. Preserve identity, garment design, and proportions; do not copy people or brands from the reference. Match perspective and contact shadows.'
                ),
                slots: [personSlot(), garmentSlot(), styleReferenceSlot(2)],
                size: '864x1152',
                difficulty: 'advanced'
            }
        ]
    },
    {
        id: 'creative-stylization',
        title: text('创意风格化', 'Creative Stylization'),
        summary: text(
            '在保留主体识别特征和构图的前提下，探索不同媒介与视觉语言。',
            'Explore new media and visual languages while retaining subject identity and composition.'
        ),
        preparation: text(
            '选择主体轮廓清晰、构图完整的图片；提前确定哪些身份、文字或品牌元素必须保留。',
            'Choose a well-composed image with a clear subject and decide which identity, text, or brand elements must remain.'
        ),
        limitations: text(
            '风格化会重解释纹理、颜色和细节，不能保证文字、Logo 或身份完全一致。发布前应放大检查。',
            'Stylization reinterprets texture, color, and detail and may alter text, logos, or identity. Inspect the result closely before publishing.'
        ),
        tags: [text('风格化', 'Stylization'), text('创意', 'Creative'), text('单图编辑', 'Single-image edit')],
        cases: [
            {
                slug: 'watercolor',
                title: text('透明水彩插画', 'Transparent Watercolor Illustration'),
                objective: text(
                    '把主体转化为有纸张留白、透明叠色和自然水痕的水彩插画。',
                    'turning the subject into watercolor with paper breathing room, transparent washes, and natural blooms.'
                ),
                prompt: text(
                    '将这张图片转化为透明水彩插画。保留主体轮廓、姿态和关键识别特征，使用可见纸张纹理、湿画法叠色、柔和边缘和克制留白。避免厚重油画笔触、过度锐化或额外物体。',
                    'Transform this image into a transparent watercolor illustration. Preserve silhouette, pose, and identifying features. Use visible paper texture, wet-on-wet washes, soft edges, and restrained negative space. Avoid heavy oil strokes, oversharpening, or added objects.'
                ),
                slots: [targetImageSlot()]
            },
            {
                slug: 'animated-film',
                title: text('温暖动画电影感', 'Warm Animated-Film Look'),
                objective: text(
                    '形成手绘动画电影质感，并保持主体表情、姿态和场景关系。',
                    'creating a hand-painted animated-film feel while preserving expression, pose, and scene relationships.'
                ),
                prompt: text(
                    '把图片转化为温暖的手绘动画电影画面。保留人物或主体的身份特征、表情、姿态和主要构图，使用清晰轮廓、柔和体积光、自然色彩层次和细腻背景笔触。不要加入新角色或改变故事关系。',
                    'Transform the image into a warm hand-painted animated-film frame. Preserve identity, expression, pose, and composition. Use clear shapes, soft volumetric light, natural color layers, and detailed background brushwork. Do not add characters or change scene relationships.'
                ),
                slots: [targetImageSlot()]
            },
            {
                slug: 'clay-model',
                title: text('黏土模型质感', 'Clay Model Treatment'),
                objective: text(
                    '将主体重塑为有手工压痕、柔和体积和棚拍光线的黏土模型。',
                    'recasting the subject as a handcrafted clay model with soft volume and studio lighting.'
                ),
                prompt: text(
                    '将主体重塑为手工黏土模型风格。保留可识别的轮廓、比例、表情和配色，呈现细微指压纹理、圆润边缘、哑光材质、可信接触阴影和简洁棚拍光线。避免塑料高光和多余道具。',
                    'Recast the subject as a handcrafted clay model. Preserve recognizable silhouette, proportions, expression, and colors. Add subtle finger-pressed texture, rounded edges, matte material, believable contact shadows, and clean studio light. Avoid plastic gloss or extra props.'
                ),
                slots: [targetImageSlot()]
            },
            {
                slug: 'cinematic-poster',
                title: text('电影海报构图', 'Cinematic Poster Composition'),
                objective: text(
                    '把主体组织成有明确焦点、层次和留字空间的电影海报画面。',
                    'organizing the subject into a cinematic poster with clear focus, depth, and usable title space.'
                ),
                prompt: text(
                    '将原图重构为电影海报画面，保留主体身份和关键物体。使用明确视觉焦点、前中后景层次、戏剧性但可信的光线和可供后期排字的干净留白。不要生成伪文字、Logo 或与原图无关的人物。',
                    'Recompose the source as a cinematic poster while preserving identity and key objects. Create a clear focal point, foreground-to-background depth, dramatic but plausible lighting, and clean negative space for later typography. Do not generate fake text, logos, or unrelated people.'
                ),
                slots: [targetImageSlot(), styleReferenceSlot()],
                size: '864x1152',
                difficulty: 'intermediate'
            }
        ]
    },
    {
        id: 'ecommerce-product-scenes',
        title: text('电商商品场景图', 'E-commerce Product Scenes'),
        summary: text(
            '从清晰商品图创建白底、生活方式、节日促销和材质特写方向。',
            'Turn clear product images into clean, lifestyle, seasonal, and material-focused presentation directions.'
        ),
        preparation: text(
            '准备完整商品图，确保轮廓、Logo、标签和关键文字可见；复杂品牌可提供可选风格参考。',
            'Prepare a complete product image with visible silhouette, logo, labels, and key text; complex brands may add an optional style reference.'
        ),
        limitations: text(
            '生成结果可能改变小字、Logo、接口和材质细节。商业发布前必须与实物和品牌规范逐项核对。',
            'Generated results may alter fine text, logos, ports, or material details. Compare every commercial result with the real product and brand guidelines.'
        ),
        tags: [text('电商', 'E-commerce'), text('商品', 'Product'), text('营销视觉', 'Marketing visual')],
        cases: [
            {
                slug: 'clean-background',
                title: text('纯净商品主图', 'Clean Product Hero Image'),
                objective: text(
                    '清理背景并生成边缘干净、比例准确、阴影自然的商品主图。',
                    'creating a clean product hero image with accurate proportions, edges, and natural grounding shadow.'
                ),
                prompt: text(
                    '保留商品的准确结构、比例、颜色、Logo、标签和可见文字，移除原背景与杂物，置于干净中性背景。修复边缘与透明区域，添加克制的接触阴影，不改变接口、按钮或包装信息。',
                    'Preserve exact product structure, proportions, colors, logo, labels, and visible text. Remove the original background and distractions, place the product on a clean neutral surface, refine edges and transparent areas, and add restrained contact shadow. Do not alter ports, buttons, or packaging information.'
                ),
                slots: [productSlot()],
                background: 'opaque'
            },
            {
                slug: 'lifestyle-scene',
                title: text('生活方式场景', 'Lifestyle Product Scene'),
                objective: text(
                    '把商品放入尺度、透视和光线可信的真实使用环境。',
                    'placing the product in a believable use environment with correct scale, perspective, and lighting.'
                ),
                prompt: text(
                    '将商品放入符合其真实用途的生活方式场景。保持商品结构、比例、配色、Logo 和文字准确，使相机视角、环境尺度、接触阴影、反射和光线方向一致。场景简洁，不能遮挡关键卖点。',
                    'Place the product in a lifestyle scene appropriate to its real use. Preserve structure, proportions, colors, logo, and text. Match camera angle, environmental scale, contact shadow, reflections, and lighting direction. Keep the scene restrained and do not obscure key selling points.'
                ),
                slots: [productSlot()],
                difficulty: 'intermediate'
            },
            {
                slug: 'seasonal-promotion',
                title: text('节日促销视觉', 'Seasonal Promotion Visual'),
                objective: text(
                    '围绕商品建立节日氛围和排版留白，同时保持品牌与商品信息可核对。',
                    'building seasonal atmosphere and layout space around the product while keeping brand and product details reviewable.'
                ),
                prompt: text(
                    '以第一张商品图为唯一商品主体，参考第二张图的色调和材质语言，构建克制的节日促销场景。保留商品、Logo、包装文字和比例，预留干净排版区域，不生成促销文案或伪造品牌元素。',
                    'Use the first image as the sole product subject and the second only for palette and material language. Build a restrained seasonal promotional scene. Preserve product, logo, packaging text, and scale, leave clean layout space, and do not generate promotional copy or fabricated brand elements.'
                ),
                slots: [productSlot(), styleReferenceSlot()],
                difficulty: 'intermediate'
            },
            {
                slug: 'material-detail',
                title: text('材质细节特写', 'Material Detail Close-Up'),
                objective: text(
                    '突出真实材质、表面纹理和制造细节，不改变商品结构。',
                    'highlighting truthful material, surface texture, and manufacturing details without changing product structure.'
                ),
                prompt: text(
                    '生成商品材质细节特写，保持原商品的结构、颜色和表面特征。通过近景构图、侧向柔光和清晰景深突出纹理、接缝与工艺，避免虚构纹理、夸张反光或改变 Logo 和文字。',
                    'Create a close-up focused on the product’s material while preserving structure, color, and surface characteristics. Use close framing, soft side light, and controlled depth of field to reveal texture, seams, and craftsmanship. Avoid invented texture, exaggerated reflections, or altered logos and text.'
                ),
                slots: [productSlot()],
                size: '1152x864',
                difficulty: 'intermediate'
            }
        ]
    },
    {
        id: 'image-enhancement-cleanup',
        title: text('图片清晰增强与背景清理', 'Image Enhancement and Cleanup'),
        summary: text(
            '面向现代照片和商业图片，处理清晰度、杂物、背景和光线问题。',
            'Improve clarity, distractions, backgrounds, and lighting in modern or commercial images.'
        ),
        preparation: text(
            '使用分辨率尽可能高的原图，并明确哪些主体、文字、边缘和背景元素必须保留。',
            'Use the highest-resolution source available and identify the subject, text, edges, and background elements that must remain.'
        ),
        limitations: text(
            '增强和重绘可能制造不存在的纹理、文字或背景细节。涉及商品、证据或记录用途时必须人工核验。',
            'Enhancement and repainting may invent texture, text, or background detail. Manually verify results used for products, evidence, or records.'
        ),
        tags: [text('增强', 'Enhancement'), text('清理', 'Cleanup'), text('现代照片', 'Modern photos')],
        cases: [
            {
                slug: 'modern-photo-clarity',
                title: text('现代照片清晰增强', 'Modern Photo Clarity'),
                objective: text(
                    '降低噪点和轻微模糊，恢复自然边缘与局部对比度。',
                    'reducing noise and mild blur while recovering natural edges and local contrast.'
                ),
                prompt: text(
                    '增强这张现代照片的清晰度。降低噪点、压缩痕迹和轻微模糊，恢复自然边缘、局部对比度和真实纹理。保留人物身份、文字、颜色和构图，避免过度锐化、光晕或虚构细节。',
                    'Improve clarity in this modern photo. Reduce noise, compression artifacts, and mild blur while recovering natural edges, local contrast, and truthful texture. Preserve identity, text, color, and composition; avoid oversharpening, halos, or invented detail.'
                ),
                slots: [targetImageSlot(text('待增强图片', 'Image to enhance'))]
            },
            {
                slug: 'remove-distractions',
                title: text('移除背景杂物', 'Remove Background Distractions'),
                objective: text(
                    '移除指定杂物并连续重建被遮挡的背景纹理和光影。',
                    'removing selected distractions and rebuilding continuous background texture and lighting.'
                ),
                prompt: text(
                    '移除背景中分散注意力的杂物，但保留主体、主体接触阴影和重要环境线索。根据周围纹理、透视和光线连续重建空缺区域，不移动主体，不改变文字或主要构图。',
                    'Remove distracting background objects while preserving the subject, contact shadows, and important environmental cues. Rebuild missing areas continuously from surrounding texture, perspective, and lighting. Do not move the subject or alter text or composition.'
                ),
                slots: [targetImageSlot(text('待清理图片', 'Image to clean'))],
                difficulty: 'intermediate'
            },
            {
                slug: 'background-rebuild',
                title: text('重绘简洁背景', 'Rebuild a Clean Background'),
                objective: text(
                    '保留主体并替换为透视、边缘和接触阴影一致的简洁背景。',
                    'retaining the subject while replacing the background with consistent perspective, edges, and grounding shadow.'
                ),
                prompt: text(
                    '完整保留主体的形状、比例、颜色、文字和细节，将背景重绘为简洁、自然、与主体用途匹配的环境。精确处理头发或产品边缘、透明区域、接触阴影和反射，使透视与光线一致。',
                    'Preserve the subject’s shape, proportions, colors, text, and details. Rebuild the background as a clean, natural environment suited to the subject. Refine hair or product edges, transparent areas, contact shadows, and reflections so perspective and lighting remain consistent.'
                ),
                slots: [targetImageSlot(text('主体与原背景', 'Subject with original background'))],
                difficulty: 'intermediate'
            },
            {
                slug: 'lighting-balance',
                title: text('光线与色温优化', 'Lighting and White-Balance Correction'),
                objective: text(
                    '平衡曝光、阴影和色温，同时保留场景原有时间与氛围。',
                    'balancing exposure, shadows, and white balance while preserving the scene’s time and mood.'
                ),
                prompt: text(
                    '优化照片的曝光、动态范围、白平衡和局部光线。恢复高光与阴影细节，校正不自然色偏，保持肤色和物体颜色真实。保留原场景的时间、天气和氛围，不添加新的光源效果。',
                    'Correct exposure, dynamic range, white balance, and local lighting. Recover highlight and shadow detail, remove unnatural color casts, and keep skin and object colors truthful. Preserve the scene’s time, weather, and mood without adding new light effects.'
                ),
                slots: [targetImageSlot(text('待调光图片', 'Image to relight'))]
            }
        ]
    },
    {
        id: 'portrait-headshots',
        title: text('人像头像与形象照', 'Portraits and Headshots'),
        summary: text(
            '从现有人像创建职业头像、社交头像、杂志人像和正式证件感方向。',
            'Develop professional, social, editorial, and formal portrait directions from an existing portrait.'
        ),
        preparation: text(
            '选择面部清晰、无遮挡、光线均匀的人像；需要特定构图或色调时可添加一张风格参考。',
            'Choose a clear, unobstructed portrait with even lighting; add an optional style reference for a specific composition or palette.'
        ),
        limitations: text(
            'AI 可能改变五官、发型、服装和皮肤纹理。结果不能直接用于法定身份证件、生物识别或身份验证。',
            'AI may alter facial features, hair, clothing, or skin texture. Results must not be used directly for legal ID, biometrics, or identity verification.'
        ),
        tags: [text('人像', 'Portrait'), text('头像', 'Headshot'), text('身份一致性', 'Identity consistency')],
        cases: [
            {
                slug: 'professional-headshot',
                title: text('职业形象头像', 'Professional Headshot'),
                objective: text(
                    '形成自然可信、背景克制、适合职业资料的半身头像。',
                    'creating a natural, restrained headshot suitable for professional profiles.'
                ),
                prompt: text(
                    '将人像优化为自然可信的职业形象头像。严格保留身份、年龄、脸型、五官比例、发型和肤色，使用整洁服装、克制中性背景、柔和正面光和自然皮肤纹理。避免过度磨皮和夸张商务布景。',
                    'Refine the portrait into a natural professional headshot. Strictly preserve identity, age, face shape, feature proportions, hair, and skin tone. Use tidy clothing, a restrained neutral background, soft frontal light, and natural skin texture. Avoid heavy retouching or exaggerated corporate sets.'
                ),
                slots: [personSlot()],
                size: '864x1152'
            },
            {
                slug: 'social-avatar',
                title: text('轻松社交头像', 'Relaxed Social Avatar'),
                objective: text(
                    '建立亲和、清晰、适合小尺寸显示的社交头像。',
                    'creating a friendly, clear social avatar that reads well at small sizes.'
                ),
                prompt: text(
                    '将人像优化为轻松亲和的社交头像。保留身份、年龄、五官、发型和自然表情，使用简洁构图、柔和环境光和有适度色彩的干净背景。保证面部在小尺寸下清晰，不添加夸张滤镜或配饰。',
                    'Refine the portrait into a relaxed, approachable social avatar. Preserve identity, age, features, hair, and natural expression. Use simple framing, soft ambient light, and a clean background with restrained color. Keep the face clear at small sizes and avoid exaggerated filters or accessories.'
                ),
                slots: [personSlot()]
            },
            {
                slug: 'editorial-portrait',
                title: text('杂志编辑人像', 'Editorial Portrait'),
                objective: text(
                    '参考可选视觉样图建立更有层次的杂志构图和光线。',
                    'using an optional visual reference to establish layered editorial composition and lighting.'
                ),
                prompt: text(
                    '以第一张图人物为唯一身份主体，参考第二张图的构图、色调和光线语言，制作克制的杂志编辑人像。保留脸部、年龄、发型和身体比例，不复制参考图中的人物、服饰或品牌；建立有层次的光影和干净留字空间。',
                    'Use the person in the first image as the sole identity subject and the second only for composition, palette, and lighting language. Create a restrained editorial portrait. Preserve face, age, hair, and proportions; do not copy people, clothing, or brands from the reference. Build layered light and clean typography space.'
                ),
                slots: [personSlot(), styleReferenceSlot()],
                size: '864x1152',
                difficulty: 'intermediate'
            },
            {
                slug: 'formal-id-style',
                title: text('正式证件感照片', 'Formal ID-Style Portrait'),
                objective: text(
                    '生成构图端正、背景纯净的正式头像方向，但不作为法定证件。',
                    'creating a centered portrait with a clean background for formal presentation, not legal identification.'
                ),
                prompt: text(
                    '将人像整理为正式证件感构图：正面视角、头肩居中、表情自然、纯净均匀背景和柔和无戏剧性的光线。严格保留身份、年龄、五官比例和肤色，不改变脸型，不进行夸张美化，不添加制服或官方标识。',
                    'Arrange the portrait in a formal ID-style composition: frontal view, centered head and shoulders, natural expression, clean even background, and soft non-dramatic light. Strictly preserve identity, age, feature proportions, and skin tone. Do not reshape the face, over-retouch, or add uniforms or official marks.'
                ),
                slots: [personSlot()],
                size: '864x1152'
            }
        ]
    }
];

function buildDefaultShowcaseCatalog(): ShowcaseCatalog {
    const assets: ShowcaseAsset[] = [];
    const cases: ShowcaseCase[] = [];
    const topics: ShowcaseTopic[] = DEFAULT_TOPIC_SPECS.map((topicSpec, topicIndex) => {
        const topicCases = topicSpec.cases.map((caseSpec, caseIndex) => {
            const showcaseCase = makeCase(topicSpec, topicIndex, caseSpec, caseIndex, assets);
            cases.push(showcaseCase);
            return showcaseCase;
        });

        return {
            id: topicSpec.id,
            slug: topicSpec.id,
            title: topicSpec.title,
            summary: topicSpec.summary,
            preparation: topicSpec.preparation,
            limitations: topicSpec.limitations,
            tags: topicSpec.tags,
            featured: true,
            sortOrder: (topicIndex + 1) * 100,
            coverAssetId: topicCases[0].coverAssetId,
            caseIds: topicCases.map((showcaseCase) => showcaseCase.id)
        };
    });

    return {
        schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
        catalogRevision: 'builtin-2026-08-03-v1',
        generatedAt: GENERATED_AT,
        contentNotice: text(
            '内置媒体仅为示例占位预览，用于说明输入与期望输出位置，不代表真实 AI 生成素材。',
            'Built-in media are sample placeholder previews that illustrate input and expected-output positions; they are not actual AI-generated assets.'
        ),
        topics,
        cases,
        assets
    };
}

export const DEFAULT_SHOWCASE_CATALOG: ShowcaseCatalog = buildDefaultShowcaseCatalog();
